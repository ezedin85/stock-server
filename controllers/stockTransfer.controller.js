const tsfrHelper = require("../helpers/transferHelper");
const utils = require("../utils/utils");
const LocationModel = require("../models/location.model");
const appAssert = require("../utils/appAssert");
const HTTP_STATUS = require("../constants/http");
const catchErrors = require("../utils/catchErrors");
const {
  handleLowStockNotification,
  checkStockAvailability,
} = require("../utils/common");
const TransferModel = require("../models/transfer.model");
const TransferProductModel = require("../models/transferProduct.model");

exports.index = catchErrors(async (req, res) => {
  // validate request
  const location = req.currentLocation;

  // call service
  const transfers = await tsfrHelper.getTransfers({ location });

  // return response
  return res.status(HTTP_STATUS.OK).json(transfers);
});

exports.addRecord = catchErrors(async (req, res) => {
  //1. validate request
  const { products, receiver } = req.body;
  const location = req.currentLocation;
  const created_by = req.userId;

  //1.1 assert receiver exists
  utils.validateRequiredFields({ receiver });

  //1.2 validate transfer products
  tsfrHelper.validateTransferProducts(products);

  //1.3 Prevent transferring to the same location
  appAssert(
    !location.equals(receiver),
    HTTP_STATUS.BAD_REQUEST,
    "Cannot transfer to the same location!"
  );

  //1.4 assert receiver location exists
  const receiver_location = await LocationModel.findOne({
    _id: receiver,
    deleted: false,
  });
  appAssert(
    receiver_location,
    HTTP_STATUS.BAD_REQUEST,
    "Receiver Location not found!"
  );

  //1.5 check stock availability
  const { can_proceed, stock_error } = await checkStockAvailability({
    location,
    items: products,
  });
  appAssert(can_proceed, HTTP_STATUS.BAD_REQUEST, stock_error);

  //2 call service
  await tsfrHelper.transferProducts({
    location,
    receiver,
    products,
    created_by,
  });

  await handleLowStockNotification({ req, items: products });

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: `Transfer created successfully` });
});

exports.getRecord = catchErrors(async (req, res) => {
  // validate request
  const location = req.currentLocation;
  const { id } = req.params;

  //2. call service

  //2.1 find the transfer and check if the current location is sender or receiver
  const transfer = await TransferModel.findOne({
    _id: id,
    $or: [{ sender: location }, { receiver: location }],
  }).populate([
    { path: "created_by updated_by", select: "first_name last_name" },
    { path: "sender", select: "name" },
    { path: "receiver", select: "name" },
  ]);

  appAssert(
    transfer,
    HTTP_STATUS.BAD_REQUEST,
    "The selected transfer does not belong to your current location."
  );

  const transferProducts = await TransferProductModel.find({
    transfer_id: transfer._id,
  }).populate([
    {
      path: "product",
      select: "name image unit",
      populate: { path: "unit", select: "code" },
    },
  ]);

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ ...transfer.toObject(), products: transferProducts });
});

//🟩 Retrun Product
exports.returnProduct = catchErrors(async (req, res) => {
  // validate request
  const { transferProduct, transfer, quantity } = await tsfrHelper.validateReceiveOrReturn(
    req,
    "return"
  );

  // check if there is enough quantity
  tsfrHelper.validateEnoughQuantity(quantity, transferProduct);

  await tsfrHelper.returnTransferedProduct({
    transfer_product_id: transferProduct._id,
    transfer_id: transfer._id,
    new_returning_quantity: quantity,
  });

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${quantity} Item(s) Returned Successfully` });
});


exports.receiveProduct = catchErrors(async (req, res) => {
  // validate request
  const { transferProduct, transfer, quantity, location } = await tsfrHelper.validateReceiveOrReturn(
    req,
    "receive"
  );

  // check if there is enough quantity
  tsfrHelper.validateEnoughQuantity(quantity, transferProduct);

  // call service
  await tsfrHelper.receiveTransferredProduct({
    location,
    transfer_product_id: transferProduct._id,
    transfer_id: transfer._id,
    new_receiving_quantity: quantity,
  });

  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${quantity} Item(s) Received Successfully` });
});

