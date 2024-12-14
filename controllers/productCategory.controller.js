const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const ProductCategoryModel = require("../models/productCategory.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");

exports.getRecords = catchErrors(async (req, res) => {
  // call service
  const productCategories = await ProductCategoryModel.find({
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
  return res.status(HTTP_STATUS.OK).json(productCategories);
});


exports.getCategoryNames = catchErrors(async(req, res) => {
    // call service
    const productCategories = await ProductCategoryModel.find({
      deleted: false,
    }).select("name")
  
    // return response
    return res.status(HTTP_STATUS.OK).json(productCategories);
});

exports.getRecord = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;

  // call service
  const productCategory = await ProductCategoryModel.findOne({
    _id: id,
    deleted: false,
  });

  //assert record exists
  appAssert(productCategory, HTTP_STATUS.NOT_FOUND, `Record not found`);

  // return response
  return res.status(HTTP_STATUS.OK).json(productCategory);
});

exports.addRecord = catchErrors(async (req, res) => {
  // validate request
  const { name } = req.body;
  const created_by = req.userId;

  //assert required fields
  utils.validateRequiredFields({ name });

  const existing_record = await ProductCategoryModel.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  //assert no name conflict
  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product Category with the same name already exists!"
  );

  // call service
  await ProductCategoryModel.create({ name, created_by });

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: `Product Category created successfully` });
});

exports.updateRecord = catchErrors(async (req, res) => {
  // validate request
  const { name } = req.body;
  const { id } = req.params;
  const updated_by = req.userId;

  //assert required fields
  utils.validateRequiredFields({ name });

  const existing_record = await ProductCategoryModel.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  //assert no name conflict
  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product Category with the same name already exists!"
  );

  const productCategoryData = await ProductCategoryModel.findOne({ _id: id, deleted: false });
  //assert product is found
  appAssert(productCategoryData, HTTP_STATUS.NOT_FOUND, `Record not found!`);

  // call service
  const updatedRecord = await ProductCategoryModel.findByIdAndUpdate(
    id,
    {
      name,
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
    .json({ message: `Product Category Updated Successfull` });
});

exports.deleteRecord = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  const product_category = await ProductCategoryModel.findOne({
    _id: id,
    deleted: false,
  });

  //assert record exists
  appAssert(product_category, HTTP_STATUS.BAD_REQUEST, "Record not found!");

  // call service
  const milliseconds_now = Date.now(); //add unique, if item gets deleted many times
  product_category.name = `_${product_category.name}_${milliseconds_now}`;
  product_category.deleted = true;
  product_category.deleted_by = req.userId;
  await product_category.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Product Category deleted Successfully` });
});
