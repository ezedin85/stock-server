const utils = require("../utils/utils");
const common = require("../utils/common");
const { TRANSACTION_TYPES } = require("../constants/constants");
const HTTP_STATUS = require("../constants/http");
const SettingModel = require("../models/setting.model");
const ContactModel = require("../models/contact.model");
const PaymentModel = require("../models/payment.model");
const TransactionModel = require("../models/transaction.model");
const BatchModel = require("../models/batch.model");
const TransactionProductModel = require("../models/transactionProduct.model");
const appAssert = require("../utils/appAssert");
const mongoose = require("mongoose");
const {
  PURCHASE_PREFIX,
  SALE_PREFIX,
  SETTING_ID,
} = require("../constants/constants");
const AppError = require("../utils/AppError");
/*


🟩 Checkes transaction type, contact and its type and ensure there is a product in the trx */
const validateTransaction = async (req, products) => {
  //get data
  const { transaction_type } = req.params;
  const { contact, note } = req.body;
  //asser transaction type
  appAssert(
    TRANSACTION_TYPES.includes(transaction_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Location Type"
  );

  let contact_type = transaction_type == "purchase" ? "supplier" : "customer";

  // validate inputs
  appAssert(contact, HTTP_STATUS.BAD_REQUEST, `${contact_type} is required!`);

  // Prevent selling to suppliers and purchasing from customers [contact type mismatch].
  const expected_contact_type =
    transaction_type === "purchase" ? "supplier" : "customer";

  console.log({ expected_contact_type });
  console.log({ contact });

  const contact_data = await ContactModel.findOne({
    _id: contact,
    contact_type: expected_contact_type,
    deleted: false,
  });
  console.log(contact_data);

  appAssert(
    contact_data,
    HTTP_STATUS.BAD_REQUEST,
    "Contact not found or contact type mismatch!"
  );

  return { contact, note, transaction_type };
};

const validateTrxProducts = (products, transaction_type) => {
  //loop thorugh products & remove products without product, quantity or unit_price
  products.forEach(({ product, quantity, unit_price }) => {
    const validations = [
      [product, "Please select a product for all entries."],
      [
        Number(quantity) > 0,
        "Some products have a quantity less than zero. Please update them.",
      ],
      [
        Number(unit_price) > 0,
        "Some products have a unit less than zero. Please update them.",
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
    `A product cannot be ${
      transaction_type == "purchase" ? "purchased" : "sold"
    } more than once in a single transaction.`
  );
};

//🟩  Returns Unique sequence based trxID
const getTransactionId = async ({ transaction_type, session }) => {
  const settings = await SettingModel.findOneAndUpdate(
    { setting_id: SETTING_ID },
    { $inc: { trx_sequence: 1 } },
    { new: true, session }
  );

  // Assert settings document exists
  appAssert(
    settings,
    HTTP_STATUS.NOT_FOUND,
    `Setting not found for transaction ID generation.!`
  );

  let new_sequence = settings.trx_sequence;

  let trx_id;
  switch (transaction_type) {
    case "purchase":
      trx_id = PURCHASE_PREFIX + new_sequence;
      break;
    case "sale":
      trx_id = SALE_PREFIX + new_sequence;
      break;
  }

  return trx_id;
};

/*

saves purchased products :)
🟩  */
const savePurchasedProducts = async ({
  location,
  contact,
  products,
  note,
  remark,
  paid_amount,
  created_by,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //get unique trx ID
    const trx_id = await getTransactionId({
      transaction_type: "purchase",
      session,
    });

    //save transaction
    const transaction = await TransactionModel.create(
      [
        {
          trx_id,
          contact,
          location,
          transaction_type: "purchase",
          note,
          created_by,
        },
      ],
      { session }
    );

    //iterate through to be purchased products and save them
    for (const product of products) {
      await purchaseProduct({
        session,
        location,
        product_id: product.product,
        quantity: product.quantity,
        unit_price: product.unit_price,
        expiry_date: product.expiry_date,
        transaction_id: transaction[0]?._id,
      });
    }

    //save payment, if there any initial payment
    if (paid_amount) {
      await PaymentModel.create(
        [
          {
            transaction: transaction[0]?._id,
            amount: paid_amount,
            remark,
            payment_type: "PAID",
            created_by,
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    session.endSession();
  }
};

//🟩 Saves a single purchase Product
async function purchaseProduct({
  session,
  location,
  product_id,
  quantity,
  unit_price,
  expiry_date,
  transaction_id,
}) {
  let settings = await SettingModel.findOne({
    setting_id: SETTING_ID,
  }).session(session);
  const is_expiry_date_considered = settings.is_expiry_date_considered;

  let batch = await BatchModel.create(
    [
      {
        product: product_id,
        location,
        total_quantity: quantity,
        quantity_in_stock: quantity,
        unit_purchase_cost: unit_price,
        expiry_date: is_expiry_date_considered ? expiry_date : null, //don't save expiry date if not considred
      },
    ],
    { session }
  );

  await TransactionProductModel.create(
    [
      {
        transaction_id,
        product: product_id,
        batches: [
          {
            batch: batch[0]?._id,
            quantity,
          },
        ],
        unit_price,
      },
    ],
    { session }
  );
}

//🟩  a helper to Save a single sale Product */
async function saleProduct({
  location,
  session,
  product_id,
  selling_quantity,
  vat_percentage,
  transaction_id,
  unit_price,
}) {
  let batch_data_for_transaction = [];

  // Retrieve batches with available stock and unexpired items, sorted by creation date (FIFO).
  const batches_with_available_stock = await common.getStockAvailableBatches({
    location,
    product_id,
  });

  let total_sold = 0; // Tracks the total quantity sold for a single product across multiple batches
  for (const batch of batches_with_available_stock) {
    // Stop processing if the required quantity has already been fulfilled
    if (total_sold >= selling_quantity) {
      break;
    }

    // Determine the quantity to sell from this batch as the smaller value between
    // the stock available in the batch and the remaining quantity needed to fulfill the order
    let qty_to_sell_on_this_batch = Math.min(
      batch.quantity_in_stock,
      selling_quantity - total_sold
    );

    //for tracking how much taken from the current batch
    batch_data_for_transaction.push({
      batch: batch._id,
      quantity: qty_to_sell_on_this_batch,
    });

    // Update the cumulative total quantity sold
    total_sold += qty_to_sell_on_this_batch;

    // Deduct the quantity sold from the batch’s available stock in the inventory
    await BatchModel.findByIdAndUpdate(
      batch._id,
      {
        $inc: { quantity_in_stock: -qty_to_sell_on_this_batch },
      },
      { session }
    );
  }

  await TransactionProductModel.create(
    [
      {
        transaction_id,
        product: product_id,
        batches: batch_data_for_transaction,
        unit_price,
        vat_percentage,
      },
    ],
    { session }
  );
}

//🟩 saves purchased products

const saveSoldProducts = async ({
  location,
  contact,
  note,
  products,
  remark,
  paid_amount,
  created_by,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //get unique trx ID
    const trx_id = await getTransactionId({
      transaction_type: "sale",
      session,
    });

    //save transaction
    const transaction = await TransactionModel.create(
      [
        {
          trx_id,
          contact,
          location,
          transaction_type: "sale",
          note,
          created_by,
        },
      ],
      { session }
    );

    //iterate through to be sold products and save them
    for (const product of products) {
      await saleProduct({
        location,
        session,
        product_id: product.product,
        selling_quantity: product.quantity,
        vat_percentage: product.vat_percentage,
        transaction_id: transaction[0]?._id,
        unit_price: product.unit_price,
      });
    }

    //save payment, if there is initial payment
    if (paid_amount) {
      await PaymentModel.create(
        [
          {
            transaction: transaction[0]?._id,
            amount: paid_amount,
            remark,
            payment_type: "RECEIVED",
            created_by,
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

// 🟩 Get List of Transactions with total and paid amount */
async function getTransactions({
  transaction_type,
  filters,
  payment_filter,
  locations,
  start,
  length,
}) {
  try {
    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          ...filters,
          transaction_type: transaction_type,
          location: { $in: locations },
        },
      },
      {
        $lookup: {
          from: "transactionproducts",
          localField: "_id",
          foreignField: "transaction_id",
          as: "trx_products",
        },
      },
      {
        $unwind: {
          path: "$trx_products",
          preserveNullAndEmptyArrays: true, // Keep transactions even if they have no trx_products
        },
      },

      // Unwind batches within transactionProducts to calculate total trx product amount
      {
        $unwind: {
          path: "$trx_products.batches",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Group by transaction ID to calculate total amount for each transaction

      {
        $group: {
          _id: "$_id",
          // Calculating the total amount by summing up values computed in the $let block
          total_amount: {
            $sum: {
              $let: {
                // Defining variables (base amount, percentage)
                vars: {
                  // Calculating base_amount (qty * unit_price)
                  base_amount: {
                    $multiply: [
                      { $ifNull: ["$trx_products.batches.quantity", 0] },
                      { $ifNull: ["$trx_products.unit_price", 0] },
                    ],
                  },
                  percentage: {
                    $ifNull: ["$trx_products.vat_percentage", 0],
                  },
                },
                in: {
                  // Conditional logic to adjust the base_amount based on the percentage value
                  $cond: {
                    // Check if the percentage is greater than 0
                    if: { $gt: ["$$percentage", 0] },
                    then: {
                      // If percentage > 0, add the percentage of the base_amount to the base_amount
                      $add: [
                        "$$base_amount",
                        {
                          $multiply: [
                            "$$base_amount",
                            { $divide: ["$$percentage", 100] }, // Convert percentage to a decimal (divide by 100)
                          ],
                        },
                      ],
                    },
                    else: "$$base_amount", // If percentage is 0 or less, leave base_amount unchanged
                  },
                },
              },
            },
          },

          // Retaining the first document in the group (usually used for extracting additional details from the first record)
          trx_detail: { $first: "$$ROOT" },
        },
      },

      // Lookup to bring in payments data for each transaction
      {
        $lookup: {
          from: "payments",
          localField: "_id",
          foreignField: "transaction",
          as: "payments",
        },
      },

      // Unwind payments to calculate the total payment amount
      {
        $unwind: {
          path: "$payments",
          preserveNullAndEmptyArrays: true, // Keep transactions even if there are no payments
        },
      },

      // Group again to sum up payments and retain total_amount
      {
        $group: {
          _id: "$_id",
          total_amount: { $first: "$total_amount" },
          total_paid: { $sum: { $ifNull: ["$payments.amount", 0] } },
          trx_detail: { $first: "$trx_detail" },
        },
      },

      // Add details from transaction, adminusers, and contacts for the final output
      {
        $addFields: {
          trx_id: "$trx_detail.trx_id",
          note: "$trx_detail.note",
          transaction_type: "$trx_detail.transaction_type",
          createdAt: "$trx_detail.createdAt",
        },
      },

      // Lookup for admin user who created the transaction
      {
        $lookup: {
          from: "users",
          localField: "trx_detail.created_by",
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

      // Lookup for contact associated with the transaction
      {
        $lookup: {
          from: "contacts",
          localField: "trx_detail.contact",
          foreignField: "_id",
          as: "contact",
        },
      },
      {
        $unwind: {
          path: "$contact",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup for location associated with the transaction
      {
        $lookup: {
          from: "locations",
          localField: "trx_detail.location",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $unwind: {
          path: "$location",
          preserveNullAndEmptyArrays: true,
        },
      },

      { $match: payment_filter },

      // Final projection to format the output fields
      {
        $facet: {
          // First facet for paginated data
          data: [
            {
              $project: {
                trx_id: 1,
                note: 1,
                transaction_type: 1,
                createdAt: 1,
                total_amount: 1,
                total_paid: 1,
                created_by: {
                  first_name: "$created_by.first_name",
                  last_name: "$created_by.last_name",
                  _id: "$created_by._id",
                },
                contact: {
                  name: "$contact.name",
                  _id: "$contact._id",
                },
                location: "$location.name",
              },
            },
            { $sort: { createdAt: -1 } },
            { $skip: parseInt(start, 10) },
            { $limit: parseInt(length, 10) },
          ],
          // Second facet for the total count of records (before skip and limit)
          recordsFiltered: [
            {
              $count: "total", // Count the total number of documents matching the conditions
            },
          ],
          grand_total: [
            {
              $group: {
                _id: null,
                amount: { $sum: "$total_amount" }, // Sum of total_amount across all documents
                paid: { $sum: "$total_paid" }, // Sum of total_paid across all documents
              },
            },
          ],
        },
      },
      {
        $project: {
          data: 1,
          grand_total_amount: {
            $ifNull: [{ $arrayElemAt: ["$grand_total.amount", 0] }, 0],
          },
          grand_total_paid: {
            $ifNull: [{ $arrayElemAt: ["$grand_total.paid", 0] }, 0],
          },
          recordsFiltered: {
            // Extract the count from the recordsFiltered facet
            $ifNull: [{ $arrayElemAt: ["$recordsFiltered.total", 0] }, 0],
          },
        },
      },
    ]);

    return transactions[0];
  } catch (error) {
    console.error(
      "Error fetching the ten transactions with total amount and payments:",
      error
    );
    throw error;
  }
}

async function applyReturn({
  trx_id,
  location,
  trx_item_id,
  return_amt,
  unit_price,
  vat_percentage,
  updated_by,
}) {
  const session = await mongoose.startSession(); // Start a session
  session.startTransaction(); // Begin the transaction

  try {
    const transaction = await TransactionModel.findOne({
      _id: trx_id,
      location,
    }).session(session);

    //assert transaction exists
    appAssert(
      transaction,
      HTTP_STATUS.BAD_REQUEST,
      "Selected sale not found at your current location."
    );

    const single_trx = await TransactionProductModel.findOne({
      _id: trx_item_id,
      transaction_id: trx_id,
    });
    //assert transaction product exists
    appAssert(
      single_trx,
      HTTP_STATUS.BAD_REQUEST,
      "Selected Transaction Item not found"
    );

    let remaining_return = return_amt;

    // Loop through batches of this single trx in reverse order for (FIFO)
    // we remove the last adjustment first b/c in FIFO, the first one is calculated first
    for (
      let i = single_trx.batches?.length - 1;
      i >= 0 && remaining_return > 0;
      i--
    ) {
      const batch = single_trx.batches[i];

      // if the remainig return is greater than the batch quantity, remove this batch from this transaction
      if (remaining_return >= batch.quantity) {
        // Subtract the quantity of the current batch from the remaining return amount.
        remaining_return -= batch.quantity;

        // return items to the batch
        await BatchModel.findOneAndUpdate(
          { _id: batch.batch, location },
          {
            $inc: { quantity_in_stock: batch.quantity },
          },
          { session }
        );

        // Remove this batch b/c the items taken are returned back to the batch
        single_trx.batches.splice(i, 1);
      } else {
        //if only some of items taken from the batch are being returned, return back the returned amount

        // deduct trx batch quantity
        batch.quantity -= remaining_return;

        // Update batch quantity for partial deduction
        await BatchModel.findOneAndUpdate(
          { _id: batch.batch, location },
          {
            $inc: { quantity_in_stock: remaining_return }, // return to the stock
          },
          { session }
        );

        remaining_return = 0; // Deduction is done
      }
    }

    single_trx.unit_price = unit_price;
    single_trx.vat_percentage = vat_percentage;
    await single_trx.save({ session });
    // Save the updated stock adjustment
    transaction.updated_by = updated_by;
    await transaction.save({ session });

    await session.commitTransaction(); // Commit the transaction
    session.endSession(); // End the session

    return transaction;
  } catch (error) {
    await session.abortTransaction(); // Rollback the transaction in case of error
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    // End the session
    session.endSession();
  }
}

const applyNewStockOut = async ({
  req,
  trx_id,
  trx_item_id,
  additional_deduct_amount,
  unit_price,
  vat_percentage,
  updated_by,
}) => {
  const session = await mongoose.startSession(); // Start a session
  session.startTransaction(); // Begin the transaction

  try {
    const location = req.currentLocation;

    // Find the transaction by ID within the session
    const transaction = await TransactionModel.findOne({
      _id: trx_id,
      location,
    }).session(session);

    //assert transaction exists
    appAssert(
      transaction,
      HTTP_STATUS.BAD_REQUEST,
      "Selected sale not found at your current location."
    );

    const single_trx = await TransactionProductModel.findOne({
      _id: trx_item_id,
      transaction_id: trx_id,
    });

    //assert transaction product exists
    appAssert(
      single_trx,
      HTTP_STATUS.BAD_REQUEST,
      "Selected Transaction Item not found"
    );

    let new_stockout_data = [];

    // Retrieve batches with available stock and unexpired items, sorted by creation date (FIFO).
    const batches_with_available_stock = await common.getStockAvailableBatches({
      location,
      product_id: single_trx.product,
    });

    let total_decreased = 0; // Tracks the total quantity decreased across multiple batches
    for (const batch of batches_with_available_stock) {
      // Stop processing if the required quantity has already been fulfilled
      if (total_decreased >= additional_deduct_amount) {
        break;
      }

      // Determine the quantity to deduct from this batch as the smaller value between
      // the stock available in the batch and the remaining quantity needed to fulfill the order
      let qty_to_decrease_from_this_batch = Math.min(
        batch.quantity_in_stock,
        additional_deduct_amount - total_decreased
      );

      //data for adding in single trx data
      new_stockout_data.push({
        batch: batch._id,
        quantity: qty_to_decrease_from_this_batch,
      });

      // Update the cumulative total quantity sold
      total_decreased += qty_to_decrease_from_this_batch;

      // Deduct the quantity sold from the batch’s available stock in the inventory
      await BatchModel.findOneAndUpdate(
        { _id: batch._id, location },
        {
          $inc: { quantity_in_stock: -qty_to_decrease_from_this_batch },
        },
        { session }
      );
    }

    single_trx.batches?.push(...new_stockout_data);
    single_trx.unit_price = unit_price;
    single_trx.vat_percentage = vat_percentage;
    await single_trx.save({ session });

    transaction.updated_by = updated_by;
    // Save the updated stock adjustment
    await transaction.save({ session });

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

module.exports = {
  validateTransaction,
  validateTrxProducts,
  savePurchasedProducts,
  saveSoldProducts,
  getTransactions,
  applyReturn,
  applyNewStockOut,
  purchaseProduct,
  saleProduct
};
