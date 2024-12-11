const HTTP_STATUS = require("../constants/http");
const PaymentModel = require("../models/payment.model");
const appAssert = require("../utils/appAssert");
const catchErrors = require("../utils/catchErrors");
const utils = require("../utils/utils");
const TransactionModel = require("../models/transaction.model");

exports.getTrxPayments = catchErrors(async (req, res) => {
  // validate request
  const { trx_id } = req.params;
  const location = req.currentLocation;

  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    location,
  });

  //assert transaction exist and user is allowd with his current trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const payments = await PaymentModel.find({
    transaction: trx_id,
  }).populate([
    { path: "created_by", select: "first_name last_name" },
    { path: "updated_by", select: "first_name last_name" },
  ]);
  // return response
  return res.status(HTTP_STATUS.OK).json(payments);
});

exports.addPayment = catchErrors(async (req, res) => {
  // validate request
  const { trx_id } = req.params;

  //get data
  const { remark } = req.body;
  const amount = Number(req.body?.amount);

  const created_by = req.userId;
  const location = req.currentLocation;

  utils.validateRequiredFields({ amount });

  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    location,
  });

  //assert transaction exist and user is allowd with his current trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  let payment_type;
  if (transaction.transaction_type === "sale") {
    payment_type = "RECEIVED";
  } else if (transaction.transaction_type === "purchase") {
    payment_type = "PAID";
  } else {
    //should never happen but in case
    throw new AppError(HTTP_STATUS.BAD_REQUEST, "invalid Transaction Type");
  }

  // call service
  await PaymentModel.create({
    transaction: trx_id,
    amount,
    remark,
    payment_type,
    created_by,
  });

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Payment Added Successfully for the ${transaction.transaction_type}`,
  });
});

exports.updatePayment = catchErrors(async (req, res) => {
  // validate request
  //get data
  const { payment_id, trx_id } = req.params;
  const { remark } = req.body;

  const amount = Number(req.body?.amount);
  const updated_by = req.userId;
  const location = req.currentLocation;

  utils.validateRequiredFields({ amount });

  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    location,
  });

  //assert transaction exist and user is allowd with his current trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const updatedRecord = await PaymentModel.findOneAndUpdate(
    { _id: payment_id, transaction: trx_id },
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

exports.removePayment = catchErrors(async (req, res) => {
  // validate request
  const { trx_id, payment_id } = req.params;
  const location = req.currentLocation;

  const transaction = await TransactionModel.findOne({
    _id: trx_id,
    location,
  });

  //assert transaction exist and user is allowd with his current trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const deleteResult = await PaymentModel.findOneAndDelete({
    _id: payment_id,
    transaction: trx_id,
  });

  //assert payment found and updated
  appAssert(deleteResult, HTTP_STATUS.BAD_REQUEST, "Payment record not found");

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Payment deleted Successfully`,
  });
});
