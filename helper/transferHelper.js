const utils = require("../utils/utils");
const appAssert = require("../utils/appAssert");
const SettingModel = require("../models/setting.model");
const common = require("../utils/common");
const { TRANSFER_PREFIX, SETTING_ID } = require("../constants/constants");
const HTTP_STATUS = require("../constants/http");
const TransferModel = require("../models/transfer.model");
const TransferProductModel = require("../models/transferProduct.model");
const BatchModel = require("../models/batch.model");
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const getTransfers = async ({ location }) => {
  const location_object_id = new mongoose.Types.ObjectId(location);

  const transfers = await TransferModel.aggregate([
    {
      $match: {
        $or: [{ sender: location_object_id }, { receiver: location_object_id }],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "created_by",
        foreignField: "_id",
        as: "created_by",
      },
    },

    {
      $unwind: {
        path: "$created_by",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "locations",
        localField: "sender",
        foreignField: "_id",
        as: "sender",
      },
    },
    {
      $unwind: {
        path: "$sender",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "locations",
        localField: "receiver",
        foreignField: "_id",
        as: "receiver",
      },
    },
    {
      $unwind: {
        path: "$receiver",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
        $lookup: {
            from: "transferproducts",
            localField: "_id",
            foreignField: "transfer_id",
            as: "product_transfers"
        }
    },
    {
        $addFields: {
            is_closed: {
                $allElementsTrue: {
                    $map: {
                        input: "$product_transfers",
                        as: "product_transfer",
                        in: {
                            $eq: [
                                "$$product_transfer.total_quantity",
                                {
                                    $add: [
                                        "$$product_transfer.returned_quantity",
                                        { 
                                            $sum: "$$product_transfer.receiving_batches.quantity" 
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        }
    },
    {
      $project: {
        tsfr_id: 1,
        created_by: { _id: 1, first_name: 1, last_name: 1 },
        sender: { _id: 1, name: 1, location_type: 1 },
        receiver: { _id: 1, name: 1, location_type: 1 },
        createdAt: 1,
        is_closed: 1
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);
  
  return transfers;
};


const validateTransferProducts = (products) => {
  //loop thorugh products & remove products without product or quantity
  products.forEach(({ product, quantity }) => {
    const validations = [
      [product, "Please select a product for all entries."],
      [
        Number(quantity) > 0,
        "Some products have a quantity less than zero. Please update them.",
      ],
    ];

    validations.forEach(([condition, errorMessage]) =>
      appAssert(condition, HTTP_STATUS.BAD_REQUEST, errorMessage)
    );
  });

  //ensure at least one product
  appAssert(
    products.length > 0,
    HTTP_STATUS.BAD_REQUEST,
    `You must select at least one valid product.`
  );

  //ensure no duplicate product
  let selectedProducts = products.map((item) => item.product);
  appAssert(
    !utils.hasDuplicates(selectedProducts) > 0,
    HTTP_STATUS.BAD_REQUEST,
    `A product cannot be transferred more than once in a single transfer.`
  );
};

//🟩 Create Transfer helper */
const transferProducts = async ({
  location,
  receiver,
  products,
  created_by,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //get unique transaction ID
    const settings = await SettingModel.findOneAndUpdate(
      { setting_id: SETTING_ID },
      { $inc: { transfer_sequence: 1 } },
      { new: true, session }
    );
    const tsfr_id = TRANSFER_PREFIX + settings.transfer_sequence;

    //save transfer general info
    const transfer = await TransferModel.create(
      [
        {
          tsfr_id,
          sender: location,
          receiver,
          created_by,
        },
      ],
      { session }
    );

    for (const product of products) {
      let affected_batches = [];

      // Retrieve batches with available stock and unexpired items,
      const batches_with_available_stock =
        await common.getStockAvailableBatches({
          location,
          product_id: product.product,
        });

      let total_transferred = 0; // Tracks the total quantity transferred for a single product across multiple batches
      for (const batch of batches_with_available_stock) {
        // Stop processing if the required quantity has already been fulfilled
        if (total_transferred >= product.quantity) {
          break;
        }

        // Determine the quantity to sell from this batch as the smaller value between
        // the stock available in the batch and the remaining quantity needed to fulfill the order
        let qty_to_transfer_on_this_batch = Math.min(
          batch.quantity_in_stock,
          product.quantity - total_transferred
        );

        affected_batches.push({
          batch: batch._id,
          quantity: qty_to_transfer_on_this_batch,
        });

        // Update the cumulative total quantity transferred
        total_transferred += qty_to_transfer_on_this_batch;

        // Deduct the quantity transferred from the batch’s available stock in the inventory
        await BatchModel.findByIdAndUpdate(
          batch._id,
          {
            $inc: { quantity_in_stock: -qty_to_transfer_on_this_batch },
          },
          { session }
        );
      }

      await TransferProductModel.create(
        [
          {
            transfer_id: transfer?.[0]?._id,
            sending_batches: affected_batches,
            product: product.product,
            total_quantity: product.quantity,
          },
        ],
        { session }
      );
    }

    // Commit the transaction if everything went well
    await session.commitTransaction();
  } catch (error) {
    // If an error occurred, abort the transaction
    await session.abortTransaction();
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    // End the session
    session.endSession();
  }
};

module.exports = { getTransfers, validateTransferProducts, transferProducts };