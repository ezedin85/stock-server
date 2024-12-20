const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const ProductUnitModel = require("../models/productUnit.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");

exports.getRecords = catchErrors(async (req, res) => {
  // call service
  const productUnits = await ProductUnitModel.find({
    deleted: false,
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

  // return response
  return res.status(HTTP_STATUS.OK).json(productUnits);
});

exports.getUnitNames = catchErrors(async(req, res) => {
   // call service
   const productUnits = await ProductUnitModel.find({
    deleted: false,
  }).select("name code")
  
  // return response
  return res.status(HTTP_STATUS.OK).json(productUnits);
});

exports.getRecord = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;

  // call service
  const productUnit = await ProductUnitModel.findOne({
    _id: id,
    deleted: false,
  }).select("name code");

  //assert record exists
  appAssert(productUnit, HTTP_STATUS.NOT_FOUND, `Record not found`);

  // return response
  return res.status(HTTP_STATUS.OK).json(productUnit);
});

exports.addRecord = catchErrors(async (req, res) => {
  // validate request
  const { name, code } = req.body;
  const created_by = req.userId;

  //assert required fields
  utils.validateRequiredFields({ name, code });

  const existing_record = await ProductUnitModel.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, "i") } },
      { code: { $regex: new RegExp(`^${code}$`, "i") } },
    ],
  });

  //assert no name or code conflict
  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product Unit with the same name or code already exists!"
  );

  // call service
  await ProductUnitModel.create({ name, code, created_by });

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: `Product Unit created successfully` });
});

exports.updateRecord = catchErrors(async (req, res) => {
  // validate request
  const { name, code } = req.body;
  const { id } = req.params;
  const updated_by = req.userId;

  //assert required fields
  utils.validateRequiredFields({ name, code });

  const existing_record = await ProductUnitModel.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, "i") } },
      { code: { $regex: new RegExp(`^${code}$`, "i") } },
    ],
    _id: { $ne: id },
  });

  //assert no name or code conflict
  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product Unit with the same name or code already exists!"
  );

  const productUnitData = await ProductUnitModel.findOne({ _id: id, deleted: false });
  //assert product is found
  appAssert(productUnitData, HTTP_STATUS.NOT_FOUND, `Record not found!`);


  // call service
  const updatedRecord = await ProductUnitModel.findByIdAndUpdate(
    id,
    {
      name,
      code,
      updated_by,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  //assert record found and updated
  appAssert(updatedRecord, HTTP_STATUS.BAD_REQUEST, "Unable to update the product category. Please try again later.");

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Product Unit Updated Successfull` });
});

exports.deleteRecord = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  const product_unit = await ProductUnitModel.findOne({
    _id: id,
    deleted: false,
  });

  //assert record exists
  appAssert(product_unit, HTTP_STATUS.BAD_REQUEST, "Record not found!");

  // call service
  const milliseconds_now = Date.now(); //add unique, if item gets deleted many times
  product_unit.name = `_${product_unit.name}_${milliseconds_now}`;
  product_unit.code = `_${product_unit.code}_${milliseconds_now}`;
  product_unit.deleted = true;
  product_unit.deleted_by = req.userId;
  await product_unit.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Product Unit deleted Successfully` });
});
