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

//🟩  Saves a single sale Product */
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

module.exports = {
  validateTransaction,
  validateTrxProducts,
  savePurchasedProducts,
  saveSoldProducts,
};
