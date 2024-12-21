const HTTP_STATUS = require("../constants/http");
const PaymentModel = require("../models/payment.model");
const appAssert = require("../utils/appAssert");
const catchErrors = require("../utils/catchErrors");
const utils = require("../utils/utils");
const TransactionModel = require("../models/transaction.model");
const trxHelper = require("../helpers/transactionHelper");

exports.getTrxPayments = catchErrors(async (req, res) => {
  // validate request
  const { trx_id, transaction_type } = req.params;
  const location = req.currentLocation;

  //assert transaction type
  trxHelper.assertTransactionType(transaction_type);

  //assert transaction exists at user's current location
  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    transaction_type,
    location,
  });
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    `Selected ${transaction_type} not found at your current location.`
  );

  // call service
  const payments = await PaymentModel.find({
    transaction: trx_id,
  }).populate([
    { path: "created_by updated_by", select: "first_name last_name" },
  ]);

  // return response
  return res.status(HTTP_STATUS.OK).json(payments);
});

exports.addPayment = catchErrors(async (req, res) => {
  // validate request
  const { trx_id, transaction_type } = req.params;
  const { remark,amount } = req.body;
  const created_by = req.userId;
  const location = req.currentLocation;

  //1.1 assert transaction type
  trxHelper.assertTransactionType(transaction_type);

  // 1.2 validate required & numeric fields
  utils.validateNumberFields({amount}, ["amount"])

  //assert transaction exists at user's current location
  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    transaction_type,
    location,
  });
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  let payment_type =
    transaction_type === "sale"
      ? "RECEIVED"
      : transaction_type === "purchase"
      ? "PAID"
      : undefined;

  // call service
  await PaymentModel.create({
    transaction: trx_id,
    payment_type,
    amount,
    remark,
    created_by,
  });

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Payment Added Successfully for the ${transaction_type}`,
  });
});

exports.updatePayment = catchErrors(async (req, res) => {
  // validate request
  const { payment_id, trx_id, transaction_type } = req.params;
  const { remark, amount } = req.body;
  const updated_by = req.userId;
  const location = req.currentLocation;

  //1.1 assert transaction type
  trxHelper.assertTransactionType(transaction_type);

  // 1.2 validate required & numeric fields
  utils.validateNumberFields({amount}, ["amount"])

  //1.3 assert transaction exists at user's current location
  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    transaction_type,
    location,
  });

  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const updatedRecord = await PaymentModel.findOneAndUpdate(
    {
      _id: payment_id,
      transaction: trx_id, //makes sure user has permission
    },
    {
      amount,
      remark,
      updated_by,
    },
    { new: true, runValidators: true }
  );

  //assert payment found and updated
  appAssert(updatedRecord, HTTP_STATUS.BAD_REQUEST, "Payment record not found");

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Payment Updated Successfully`,
  });
});

exports.deletePayment = catchErrors(async (req, res) => {
  // validate request
  const { trx_id, payment_id, transaction_type } = req.params;
  const location = req.currentLocation;

  //assert transaction type
  trxHelper.assertTransactionType(transaction_type);

  //1.3 assert transaction exists at user's current location
  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    transaction_type,
    location,
  });
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const deleteResult = await PaymentModel.findOneAndDelete({
    _id: payment_id,
    transaction: trx_id, //makes sure user has permission
  });

  //assert payment found and deleted
  appAssert(deleteResult, HTTP_STATUS.BAD_REQUEST, "Payment record not found");

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Payment deleted Successfully`,
  });
});
