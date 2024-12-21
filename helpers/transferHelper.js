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
        as: "product_transfers",
      },
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
                        $sum: "$$product_transfer.receiving_batches.quantity",
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    {
      $project: {
        tsfr_id: 1,
        created_by: { _id: 1, first_name: 1, last_name: 1 },
        sender: { _id: 1, name: 1, location_type: 1 },
        receiver: { _id: 1, name: 1, location_type: 1 },
        createdAt: 1,
        is_closed: 1,
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);

  return transfers;
};

const validateTransferProducts = (products) => {
  //1. loop thorugh products & check product and quantity exists
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

  //2. ensure at least one product is selected
  appAssert(
    products.length > 0,
    HTTP_STATUS.BAD_REQUEST,
    `You must select at least one valid product.`
  );

  //3. ensure no duplicate product
  let selectedProducts = products.map((item) => item.product);
  appAssert(
    !utils.hasDuplicates(selectedProducts),
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
          session,
        });

      let total_transferred = 0; // Tracks the total quantity transferred for a single product across multiple batches
      for (const batch of batches_with_available_stock) {
        // Exit if required quantity is fulfilled
        if (total_transferred >= product.quantity) break;

        // Determine the quantity to deduct from the batch (minimum of available stock in the batch or
        // remaining required quantity)
        let qty_to_transfer_on_this_batch = Math.min(
          batch.quantity_in_stock,
          product.quantity - total_transferred
        );

         // Track affected batches for later use in transaction product
        affected_batches.push({
          batch: batch._id,
          quantity: qty_to_transfer_on_this_batch,
        });

        // Update the total transferred quantity
        total_transferred += qty_to_transfer_on_this_batch;

        // Deduct quantity from the batch stock
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
            product: product.product,
            sending_batches: affected_batches,
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
    throw new AppError(error.statusCode, error.message);
  } finally {
    // End the session
    session.endSession();
  }
};

const returnTransferedProduct = async ({
  transfer_product_id,
  transfer_id,
  new_returning_quantity,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    //get the transfer product data
    const transferProduct = await TransferProductModel.findOne({
      _id: transfer_product_id,
      transfer_id,
    })
      .session(session)
      .populate("sending_batches.batch");

    let remaining_return = new_returning_quantity;

    // NOTE: Iterate through the sending batches in reverse order to handle returns.
    // Since batches are saved based on the order they were stocked out,
    // we return the most recently stocked-out batch first, as if it was never out.
    for (
      let i = transferProduct.sending_batches?.length - 1;
      i >= 0 && remaining_return > 0;
      i--
    ) {
      const sending_batch = transferProduct.sending_batches[i];
    
      //get remaining quantity from transfer
      const unreceived_qty_from_this_sending_batch =
        sending_batch.quantity - sending_batch.received_qty;

      //quantity to return to current batch
      let qty_to_return_from_this_batch = Math.min(
        unreceived_qty_from_this_sending_batch,
        remaining_return
      );

      //if no item is received && all items are being returned, remove sending batch
      if (
        sending_batch.received_qty === 0 &&
        qty_to_return_from_this_batch === sending_batch.quantity
      ) {
        //remove current sending batch
        transferProduct.sending_batches.splice(i, 1);
      } else {
        //deduct possible & needed quantity
        sending_batch.quantity -= qty_to_return_from_this_batch;
      }

      // Deduct the quantity returned from the batch’s available stock in the inventory
      const updated_batch = await BatchModel.findByIdAndUpdate(
        sending_batch.batch?._id,
        {
          $inc: { quantity_in_stock: qty_to_return_from_this_batch },
        },
        { session }
      );

      //assert batch updated
      appAssert(updated_batch, HTTP_STATUS.BAD_REQUEST, "Couldn't update batch! Please try again later!")

      //deduct remaining return quantity
      remaining_return -= qty_to_return_from_this_batch;
    }


    transferProduct.returned_quantity += new_returning_quantity; //increase the returned quantity for histoty
    await transferProduct.save({ session }); //save the operation

    await session.commitTransaction();
  } catch (error) {
    // If an error occurred, abort the transaction
    await session.abortTransaction();
    throw new AppError(error.statusCode, error.message);
  } finally {
    // End the session
    session.endSession();
  }
};

const receiveTransferredProduct = async ({
  location,
  transfer_product_id,
  transfer_id,
  new_receiving_quantity,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    //get the transfer product data
    const transferProduct = await TransferProductModel.findOne({
      _id: transfer_product_id,
      transfer_id,
    })
      .session(session)
      .populate("sending_batches.batch");

    let new_receiving_batches = [];
    let remainig_receiving_qty = new_receiving_quantity;
    for (const sending_batch of transferProduct.sending_batches) {
      // Stop processing if the required quantity has already been fulfilled
      if (remainig_receiving_qty <= 0) break;

      const unreceived_qty_from_this_sending_batch =
        sending_batch.quantity - sending_batch.received_qty;

      // if all items from this sending batch are returned or received before, skip this sending batch
      if (unreceived_qty_from_this_sending_batch <= 0) continue;

      // Determine the quantity to deduct from this batch as the smaller value between
      // the stock available in the batch and the remaining quantity needed to fulfill the order
      let qty_to_receive_from_this_sending_batch = Math.min(
        unreceived_qty_from_this_sending_batch,
        remainig_receiving_qty
      );

      //1. add items to the receiving location
      const batch = await BatchModel.create(
        [
          {
            location,
            product: transferProduct.product,
            total_quantity: qty_to_receive_from_this_sending_batch,
            quantity_in_stock: qty_to_receive_from_this_sending_batch,
            unit_purchase_cost: sending_batch.batch?.unit_purchase_cost,
            expiry_date: sending_batch.batch?.expiry_date,
          },
        ],
        { session }
      );

      //2. increase received quantity
      sending_batch.received_qty += qty_to_receive_from_this_sending_batch;

      //3. deduct the remaining receiving quantity
      remainig_receiving_qty -= qty_to_receive_from_this_sending_batch;

      //save the receiving batches
      new_receiving_batches.push({
        batch: batch?.[0]?._id,
        quantity: qty_to_receive_from_this_sending_batch,
      });
    }

    transferProduct.receiving_batches.push(...new_receiving_batches);
    await transferProduct.save({ session });

    await session.commitTransaction();
  } catch (error) {
    // If an error occurred, abort the transaction
    await session.abortTransaction();
    throw new AppError(error.statusCode, error.message);
  } finally {
    // End the session
    session.endSession();
  }
};

const validateReceiveOrReturn = async (req, type) => {
  const { transfer_product_id } = req.params;
  const quantity = Number(req.body?.quantity);
  const location = req.currentLocation;

  // ✅ 1. Validate required fields
  utils.validateRequiredFields({ quantity });

  // ✅ 2. Validate 'type' (must be 'receive' or 'return')
  appAssert(
    ["receive", "return"].includes(type),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid transfer type provided!"
  );

  // ✅ 3. Get the transfer product data
  const transferProduct = await TransferProductModel.findOne({
    _id: transfer_product_id,
  });

  // ✅ 4. Assert that the transfer product exists
  appAssert(
    transferProduct,
    HTTP_STATUS.BAD_REQUEST,
    "Transfer Product not found!"
  );

  // ✅ 5. Determine the location field based on type
  const locationField = type === "receive" ? "receiver" : "sender";

  // ✅ 6. Assert user has access to the sender/receiver location
  const transfer = await TransferModel.findOne({
    _id: transferProduct.transfer_id,
    [locationField]: location,
  });

  appAssert(
    transfer,
    HTTP_STATUS.BAD_REQUEST,
    `This transfer is not available to ${type} at your current location.`
  );

  // ✅ 7. Return useful data
  return { transferProduct, transfer, quantity, location };
};

const validateEnoughQuantity = (quantity, transferProduct) => {
  
  // ✅ 1. Calculate total received and returned quantities
  const total_qty = transferProduct.total_quantity;
  const total_returned_qty = transferProduct.returned_quantity;
  let total_received_qty = transferProduct.receiving_batches.reduce(
    (acc, item) => acc + item.quantity,
    0
  );
  const received_and_returned_qty = total_returned_qty + total_received_qty;

  // ✅ 2. Calculate total remaining quantity
  const total_remaining_qty = total_qty - received_and_returned_qty;

  // ✅ 3. Assert that total_remaining_qty is valid (not negative)
  appAssert(
    total_remaining_qty >= 0,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    `Data inconsistency detected. Total remaining quantity is negative: ${total_remaining_qty}`
  );

  //✅ 4. prevent receiving or returning if requested quantity is greater than remaining
  appAssert(
    quantity <= total_remaining_qty,
    HTTP_STATUS.BAD_REQUEST,
    `No sufficient remaining quantity. Remaining: ${total_remaining_qty}, Requested: ${quantity}`
  );
};




module.exports = {
  getTransfers,
  validateTransferProducts,
  transferProducts,
  returnTransferedProduct,
  receiveTransferredProduct,
  validateReceiveOrReturn,
  validateEnoughQuantity
};
