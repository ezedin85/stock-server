const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const ContactModel = require("../models/contact.model");
const UserModel = require("../models/user.model");
const TransactionModel = require("../models/transaction.model");
const TransactionProductModel = require("../models/transactionProduct.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const trxHelper = require("../helpers/transactionHelper");
const mongoose = require("mongoose");
const BatchModel = require("../models/batch.model");

const {
  checkStockAvailability,
  handleLowStockNotification,
  isExpiryDateConsidered,
} = require("../utils/common");
const { TRANSACTION_TYPES } = require("../constants/constants");
const AppError = require("../utils/AppError");

exports.getRecords = catchErrors(async (req, res) => {
  // validate request
  const { q, page, show, contact, locs, payt_status } = req.query;
  //prevent "null" or empty strings
  const start_date = utils.normalize(req.query.start_date);
  const end_date = utils.normalize(req.query.end_date);
  const { transaction_type } = req.params;
  const location = req.currentLocation;


  //assert transaction type
  trxHelper.assertTransactionType(transaction_type);

  
  let filters = {};
  //contact filter
  if (mongoose.Types.ObjectId.isValid(contact)) {
    filters.contact = new mongoose.Types.ObjectId(contact);
  }
  //date filter
  if (start_date && end_date) {
    const start = new Date(start_date);
    start.setHours(0, 0, 0, 0); // Set start time to midnight

    const end = new Date(end_date);
    end.setHours(23, 59, 59, 999); // Set end time to the last millisecond of the day

    filters.createdAt = {
      $gte: start,
      $lte: end,
    };
  }

  // search filter
  const search_conditions = [];
  if (q) {
    const regex = { $regex: q, $options: "i" };
    search_conditions.push({ trx_id: regex });
  }

  // Add the search conditions to the main query if any exist
  if (search_conditions.length > 0) {
    filters["$or"] = search_conditions;
  }

  //payment filter
  let payment_filter = {};
  if (payt_status === "completed") {
    payment_filter = { $expr: { $gte: ["$total_paid", "$total_amount"] } };
  } else if (payt_status === "incomplete") {
    payment_filter = { $expr: { $lt: ["$total_paid", "$total_amount"] } };
  }

  //locations
  const selected_locations =
    locs
      ?.split(",")
      ?.map((loc) => loc.trim()) //remove whitespace
      ?.filter(Boolean) || //remove empty values
    []; //if no selected location

  // Initialize locations with the current selected location
  let locations = [new mongoose.Types.ObjectId(location)];

  // Only proceed if there are selected locations
  if (selected_locations.length) {
    const user = await UserModel.findById(req.userId);

    // Get user's location IDs as a Set for faster lookups
    const usersLocationsIds = new Set(
      user.locations.map((item) => item?.location._id?.toString())
    );

    // Filter and convert selected locations to ObjectId, then push them to the locations array
    selected_locations
      .filter((loc) => usersLocationsIds.has(loc.toString())) //check if use has access to the selected location
      .forEach((loc) => locations.push(new mongoose.Types.ObjectId(loc)));
  }

  // call service
  const {
    data: transactions,
    recordsFiltered = 0,
    grand_total_amount,
    grand_total_paid,
  } = await trxHelper.getTransactions({
    transaction_type,
    locations,
    filters,
    payment_filter,
    page,
    show,
  });

  // Count the total number of transactions based on the provided locations and transaction type
  const recordsTotal = await TransactionModel.countDocuments({
    location: { $in: locations },
    transaction_type,
  });

  // return response
  return res.status(HTTP_STATUS.OK).json({
    transactions,
    recordsTotal,
    recordsFiltered,
    transaction_type,
    grand_total_amount,
    grand_total_paid,
  });
});

exports.addRecord = catchErrors(async (req, res) => {
  // validate request

  const created_by = req.userId;
  const location = req.currentLocation;
  const { remark, products } = req.body;
  const paid_amount = Number(req.body?.paid_amount);

  //- check transaction type, contact
  const { contact, note, transaction_type } =
    await trxHelper.validateTransaction(req, products);

  //validate products
  trxHelper.validateTrxProducts(products, transaction_type);

  //🟩 Call services
  if (transaction_type === "purchase") {
    await trxHelper.savePurchasedProducts({
      location,
      contact,
      products,
      note,
      remark,
      paid_amount,
      created_by,
    });
  } else if (transaction_type === "sale") {
    //check stock availability for stock out
    const { can_proceed, stock_error } = await checkStockAvailability({
      location,
      items: products,
    });

    //assert if stock is availible for all sale products
    appAssert(can_proceed, HTTP_STATUS.BAD_REQUEST, stock_error);

    await trxHelper.saveSoldProducts({
      location,
      contact,
      products,
      note,
      remark,
      paid_amount,
      created_by,
    });

    await handleLowStockNotification({ req, items: products });
  }

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: `${transaction_type} created successfully` });
});

exports.getRecord = catchErrors(async (req, res) => {
  // validate request
  const { id, transaction_type } = req.params;
  const location = req.currentLocation;

  //assert transaction type
  trxHelper.assertTransactionType(transaction_type);

  const transaction = await TransactionModel.findOne({
    _id: id,
    transaction_type,
    location,
  }).populate([
    {
      path: "created_by",
      select: "first_name last_name",
    },
    {
      path: "updated_by",
      select: "first_name last_name",
    },
  ]);

  //assert transaction exist and user is allowd with his current trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  const transaction_products = await TransactionProductModel.find({
    transaction_id: id,
  })
    .populate({
      path: "product",
      select: "name image",
      populate: {
        path: "unit",
        select: "code",
      },
    })
    .populate({ path: "batches.batch", select: "expiry_date" });

  // return response
  return res.status(HTTP_STATUS.OK).json({
    ...transaction.toObject(),
    transaction_products,
  });
});

exports.updateGeneralTrxInfo = catchErrors(async (req, res) => {
  // validate request
  const { id, transaction_type } = req.params;
  const { note, contact } = req.body;
  const updated_by = req.userId;
  const location = req.currentLocation;
  //assert transaction type
  trxHelper.assertTransactionType(transaction_type);

  const transaction = await TransactionModel.findOne({
    _id: id,
    location,
  });

  //assert transaction exist at users location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // Find a contact based on transaction type and verify contact type

  const expected_contact_type =
    transaction.transaction_type == "purchase" ? "supplier" : "customer";
  const contact_data = await ContactModel.findOne({
    _id: contact,
    contact_type: expected_contact_type,
    deleted: false,
  });

  //assert selected contact exists & its correct contact type
  appAssert(
    contact_data,
    HTTP_STATUS.BAD_REQUEST,
    "Contact not found or contact type mismatch!"
  );

  // call service
  transaction.contact = contact;
  transaction.note = note;
  transaction.updated_by = updated_by;
  await transaction.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${transaction.transaction_type} Updated Successfully` });
});

exports.deleteTrxProduct = catchErrors(async (req, res) => {
  // validate request
  const { trx_item_id, transaction_type } = req.params;
  const updated_by = req.userId;
  const location = req.currentLocation;

  //assert transactio type
  trxHelper.assertTransactionType(transaction_type);

  const single_trx = await TransactionProductModel.findById(trx_item_id);
  //assert selected contact exists & its correct contact type
  appAssert(
    single_trx,
    HTTP_STATUS.BAD_REQUEST,
    "Selected Transaction Item not found"
  );

  const transaction = await TransactionModel.findOne({
    _id: single_trx.transaction_id,
    location,
    transaction_type,
  });
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  if (transaction.transaction_type === "purchase") {
    const batch_id = single_trx.batches?.[0]?.batch; // find the purchase batch(there is only one batch for purchases)
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const batch = await BatchModel.findById(batch_id).session(session);

      appAssert(
        batch.quantity_in_stock === batch.total_quantity,
        HTTP_STATUS.BAD_REQUEST,
        `Deletion not allowed: ${
          batch.total_quantity - batch.quantity_in_stock
        } items from this purchase have already been sold or transferred.`
      );

      //delete both the trx product and the associated batch
      await batch.deleteOne({ session });
      await single_trx.deleteOne({ session });

      transaction.updated_by = updated_by;
      await transaction.save({ session });

      //commit transaction
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
    } finally {
      session.endSession();
    }
  } else if (transaction.transaction_type === "sale") {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const trx_batch of single_trx.batches) {
        // return items to the batch
        await BatchModel.findOneAndUpdate(
          { _id: trx_batch.batch, location },
          {
            $inc: { quantity_in_stock: trx_batch.quantity },
          },
          { session }
        );
      }

      await single_trx.deleteOne({ session });
      transaction.updated_by = updated_by;
      await transaction.save({ session });

      //commit transaction
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
    } finally {
      session.endSession();
    }
  }

  //

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Item successfully removed from the ${transaction.transaction_type} transaction`,
  });
});

exports.updatePurchase = catchErrors(async (req, res) => {
  // validate request

  const { trx_item_id } = req.params;
  const { expiry_date } = req.body;
  const quantity = Number(req.body?.quantity);
  const unit_price = Number(req.body?.unit_price);
  utils.validateRequiredFields({ quantity, unit_price });

  const updated_by = req.userId;
  const location = req.currentLocation;

  const single_trx = await TransactionProductModel.findById(trx_item_id);

  //assert selected contact exists & its correct contact type
  appAssert(
    single_trx,
    HTTP_STATUS.BAD_REQUEST,
    "Selected purchase item not found"
  );

  const transaction = await TransactionModel.findOne({
    _id: single_trx.transaction_id,
    transaction_type: "purchase",
    location,
  });

  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected purchase not found at your current location."
  );

  //the purchase batch id [for purchase there is only one batch per item]
  const batch_id = single_trx.batches?.[0]?.batch;

  const batch = await BatchModel.findById(batch_id);
  appAssert(batch, HTTP_STATUS.BAD_REQUEST, "Batch not found!");

  const already_sold_from_batch =
    batch.total_quantity - batch.quantity_in_stock;

  // Ensure the quantity is not reduced below the number of items already sold
  appAssert(
    already_sold_from_batch <= quantity,
    HTTP_STATUS.BAD_REQUEST,
    `Quantity too low. ${already_sold_from_batch} items have already been sold!`
  );

  // call service
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    transaction.updated_by = updated_by;
    await transaction.save({ session });

    //get expiry setting
    const is_expiry_date_considered = await isExpiryDateConsidered();

    // Don't change the expiry date field, if is_expiry_date_considered is false
    const conditional_data = is_expiry_date_considered
      ? {
          expiry_date: utils.isValidDate(new Date(expiry_date))
            ? new Date(expiry_date)
            : null,
        }
      : {};

    // since there is only one batch in purchase, update only the first one
    single_trx.batches[0].quantity = quantity;
    single_trx.unit_price = unit_price;
    await single_trx.save({ session });

    //update the batch
    await BatchModel.findOneAndUpdate(
      { _id: batch_id, location },
      {
        $set: {
          total_quantity: quantity,
          unit_purchase_cost: unit_price,
          quantity_in_stock: quantity - already_sold_from_batch,
          ...conditional_data,
        },
      },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    session.endSession();
  }

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Purchased Product Updated Successfully`,
  });
});

exports.updateSale = catchErrors(async (req, res) => {
  // validate request
  const { trx_item_id } = req.params;
  const quantity = Number(req.body?.quantity);
  const unit_price = Number(req.body?.unit_price);
  const vat_percentage = Number(req.body?.vat_percentage);

  utils.validateRequiredFields({ quantity, unit_price });

  const updated_by = req.userId;
  const location = req.currentLocation;

  const single_trx = await TransactionProductModel.findById(trx_item_id);

  //assert selected contact exists & its correct contact type
  appAssert(
    single_trx,
    HTTP_STATUS.BAD_REQUEST,
    "Selected purchase item not found"
  );

  const transaction = await TransactionModel.findOne({
    _id: single_trx.transaction_id,
    transaction_type: "sale",
    location,
  });

  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected sale not found at your current location."
  );

  //previous quantity
  const prev_quantity = single_trx?.batches?.reduce(
    (acc, item) => acc + item.quantity,
    0
  );

  //assert stock has enough amount
  const { can_proceed, stock_error } = await checkStockAvailability({
    location,
    items: [
      {
        product: single_trx.product,
        quantity,
        restocked_quantity: prev_quantity,
      },
    ],
  });
  appAssert(can_proceed, HTTP_STATUS.BAD_REQUEST, stock_error);

  // call service
  //if no quantity change, save unit price, vat_percentage and updated by only

  //if no quantity change, save unit_price, vat_percentage and updated by only
  if (quantity == prev_quantity) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      single_trx.unit_price = unit_price;
      single_trx.vat_percentage = vat_percentage;
      await single_trx.save({ session });

      transaction.updated_by = updated_by;
      await transaction.save({ session });

      //commit transaction
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
    } finally {
      session.endSession();
    }
  }

  // If the new quantity is lower, add the difference back to the stock [return items]
  else if (prev_quantity > quantity) {
    // how much is being returned

    const return_amt = prev_quantity - quantity;

    await trxHelper.applyReturn({
      trx_id: transaction._id,
      location,
      trx_item_id,
      unit_price,
      vat_percentage,
      return_amt,
      updated_by,
    });
  } else if (quantity > prev_quantity) {
    // if the new quantity is grater, determine how much additional to deduct from stock
    const additional_deduct_amount = quantity - prev_quantity;
    await trxHelper.applyNewStockOut({
      req,
      trx_id: transaction._id,
      trx_item_id,
      additional_deduct_amount,
      unit_price,
      vat_percentage,
      updated_by,
    });
  }

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Sale Product Updated Successfully`,
  });
});

exports.addSaleItem = catchErrors(async (req, res) => {
  // validate request
  const { trx_id } = req.params;
  const { product } = req.body;
  const quantity = Number(req.body?.quantity);
  const unit_price = Number(req.body?.unit_price);
  const vat_percentage = Number(req.body?.vat_percentage);
  const updated_by = req.userId;
  const location = req.currentLocation;
  utils.validateRequiredFields({ product, quantity, unit_price });

  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    location,
    transaction_type: "sale",
  });

  //assert transaction exist and user is allowd with his current trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    //check stock availability for stock out
    const { can_proceed, stock_error } = await checkStockAvailability({
      location,
      items: [{ product, quantity }],
    });

    //assert if stock is availible for the selected product
    appAssert(can_proceed, HTTP_STATUS.BAD_REQUEST, stock_error);

    await trxHelper.saleProduct({
      location,
      session,
      product_id: product,
      selling_quantity: quantity,
      vat_percentage,
      transaction_id: transaction._id,
      unit_price,
    });

    //save transaction
    transaction.updated_by = updated_by;
    await transaction.save({ session });

    //commit transaction
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    session.endSession();
  }

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Item successfully added to the sale transaction`,
  });
});

exports.addPurchaseItem = catchErrors(async (req, res) => {
  // validate request
  const { trx_id } = req.params;
  const { expiry_date, product } = req.body;
  const quantity = parseFloat(req.body?.quantity);
  const unit_price = parseFloat(req.body?.unit_price);
  const updated_by = req.userId;
  const location = req.currentLocation;
  utils.validateRequiredFields({ product, quantity, unit_price });

  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    location,
    transaction_type: "purchase",
  });

  //assert transaction exist and user is allowd with his current trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await trxHelper.purchaseProduct({
      session,
      location,
      product_id: product,
      quantity,
      unit_price,
      expiry_date,
      transaction_id: transaction._id,
    });

    //save transaction
    transaction.updated_by = updated_by;
    await transaction.save({ session });

    //commit transaction
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    session.endSession();
  }

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Item successfully added to the purchase transaction`,
  });
});
