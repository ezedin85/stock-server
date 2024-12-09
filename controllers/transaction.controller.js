const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const TransactionModel = require("../models/transaction.model");
const TransactionProductModel = require("../models/transactionProduct.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const trxHelper = require("../helper/transactionHelper");
const { checkStockAvailability , handleLowStockNotification} = require("../utils/common");

exports.addRecord = catchErrors(async (req, res) => {
  // validate request

  const created_by = req.userId;
  const location = req.currentLocation;
  const { remark, products } = req.body;
  const paid_amount = Number(req.body?.paid_amount);

  console.log(req.body);

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
