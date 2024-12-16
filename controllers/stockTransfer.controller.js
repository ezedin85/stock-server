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
  // validate request
  const created_by = req.userId;
  const location = req.currentLocation;
  const { products, receiver } = req.body;

  tsfrHelper.validateTransferProducts(products);

  //assert receiver exists
  utils.validateRequiredFields({ receiver });

  // Prevent transferring to the same location
  appAssert(
    !location.equals(receiver),
    HTTP_STATUS.BAD_REQUEST,
    "Cannot transfer to the same location!"
  );

  const receiver_data = await LocationModel.findOne({
    _id: receiver,
    deleted: false,
  });

  appAssert(
    receiver_data,
    HTTP_STATUS.BAD_REQUEST,
    "Receiver Location not found!"
  );

  const { can_proceed, stock_error } = await checkStockAvailability({
    location,
    items: products,
  });
  appAssert(can_proceed, HTTP_STATUS.BAD_REQUEST, stock_error);

  // call service
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

  // call service

  //find the transfer and check if the current location is sender or receiver
  const transfer = await TransferModel.findOne({
    _id: id,
    $or: [{ sender: location }, { receiver: location }],
  }).populate([
    { path: "created_by", select: "first_name last_name" },
    { path: "sender", select: "name" },
    { path: "receiver", select: "name" },
  ]);

  appAssert(
    transfer,
    HTTP_STATUS.BAD_REQUEST,
    "The selected transfer was not found or does not belong to your current location."
  );

  const transferProducts = await TransferProductModel.find({
    transfer_id: transfer._id,
  }).populate([
    { path: "product", select: "name image unit" ,
      populate: { path: "unit", select: "code" } 

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

  const { transfer_product_id } = req.params;
  const quantity = Number(req.body?.quantity);
  const location = req.currentLocation;

  //validate required fields
  utils.validateRequiredFields({ quantity });

  //get the transfer product data
  const transferProduct = await TransferProductModel.findOne({
    _id: transfer_product_id,
  });

  // assert tharnsfer product exists
  appAssert(
    transferProduct,
    HTTP_STATUS.BAD_REQUEST,
    "Transfer Product not found!"
  );

  //find the transfer adn check if the current location is the sender
  const transfer = await TransferModel.findOne({
    _id: transferProduct.transfer_id,
    sender: location,
  });

  //assert user is has access to the sender location
  appAssert(
    transfer,
    HTTP_STATUS.BAD_REQUEST,
    "This transfer is not available for returning at your current location."
  );

  // call service
  // check if there is enough quantity
  //get total received, returned, received and returned, remaining and total quantity
  const total_qty = transferProduct.total_quantity;
  const prev_returned_qty = transferProduct.returned_quantity;
  let prev_received_qty = transferProduct.receiving_batches.reduce(
    (acc, item) => acc + item.quantity,
    0
  );
  const received_and_returned_qty = prev_returned_qty + prev_received_qty;
  const total_remaining_qty = total_qty - received_and_returned_qty;

  appAssert(
    quantity <= total_remaining_qty,
    HTTP_STATUS.BAD_REQUEST,
    `No suffiecient remaining quantity. Remaining: ${total_remaining_qty}, Requested: ${quantity}`
  );

  await tsfrHelper.returnTransferedProduct({
    transfer_product_id,
    transfer_id: transfer._id,
    new_returning_quantity: quantity,
  });

  // CONTINUE FROM THIS, JUST  BRING "returnTransferedProduct" AND CONTINUE
  //AND RECEIVE PRODUCT ALSO YKERAL

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${quantity} Item(s) Returned Successfully` });
});

exports.receiveProduct = catchErrors(async (req, res) => {
  // validate request
  const { transfer_product_id } = req.params;
  const quantity = Number(req.body?.quantity);
  const location = req.currentLocation;

  //validate required fields
  utils.validateRequiredFields({ quantity });

  //get the transfer product data
  const transferProduct = await TransferProductModel.findOne({
    _id: transfer_product_id,
  });

  // assert tharnsfer product exists
  appAssert(
    transferProduct,
    HTTP_STATUS.BAD_REQUEST,
    "Transfer Product not found!"
  );

  //find the transfer adn check if the current location is the receiver
  const transfer = await TransferModel.findOne({
    _id: transferProduct.transfer_id,
    receiver: location,
  });

  //assert user is has access to the sender location
  appAssert(
    transfer,
    HTTP_STATUS.BAD_REQUEST,
    "This transfer is not available for receiving at your current location."
  );

  // call service
  // check if there is enough quantity
  //get total received, returned, received and returned, remaining and total quantity
  const total_qty = transferProduct.total_quantity;
  const prev_returned_qty = transferProduct.returned_quantity;
  let prev_received_qty = transferProduct.receiving_batches.reduce(
    (acc, item) => acc + item.quantity,
    0
  );
  const received_and_returned_qty = prev_returned_qty + prev_received_qty;
  const total_remaining_qty = total_qty - received_and_returned_qty;

  //prevent receiving if requested quantity is greater than remaining
  appAssert(
    quantity <= total_remaining_qty,
    HTTP_STATUS.BAD_REQUEST,
    `No suffiecient remaining quantity. Remaining: ${total_remaining_qty}, Requested: ${quantity}`
  );

  await tsfrHelper.receiveTransferredProduct({
    location,
    transfer_product_id,
    transfer_id: transfer._id,
    new_receiving_quantity: quantity,
  });

  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${quantity} Item(s) Received Successfully` });
});
