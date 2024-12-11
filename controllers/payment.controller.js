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

  //assert transaction exist and user is allowd for the trx location
  appAssert(
    transaction,
    HTTP_STATUS.BAD_REQUEST,
    "Selected transaction not found at your current location."
  );

  // call service
  const payments = await PaymentModel.find({
    transaction: trx_id,
  })
  .populate([
    {path: "created_by", select: "first_name last_name"},
    {path: "updated_by", select: "first_name last_name"}
  ])
  ;

  // return response
  return res.status(HTTP_STATUS.OK).json(payments);
});
