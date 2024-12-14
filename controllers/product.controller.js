const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const ProductModel = require("../models/product.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const { isExpiryDateConsidered, hasPermissions } = require("../utils/common");
const mongoose = require("mongoose");
const UserModel = require("../models/user.model");
const { getProductsList } = require("../helpers/productHelper");

exports.getProductNameList = catchErrors(async (req, res) => {
  // call service
  const products = await ProductModel.find({
    deleted: false,
  }).select("name")
  // return response
  return res.status(HTTP_STATUS.OK).json(products);
});

exports.getRecords = catchErrors(async (req, res) => {
  // validate request
  const {
    q, //search query
    s, //start
    l, //length
    locs, //locations
    stock_status,
    category,
  } = req.query;

  const location = req.currentLocation;
  let filters = {};

  //category filter
  if (mongoose.Types.ObjectId.isValid(category)) {
    filters.category = new mongoose.Types.ObjectId(category);
  }

  // search filter
  const search_conditions = [];
  if (q) {
    const regex = { $regex: q, $options: "i" };
    search_conditions.push({ name: regex }, { sku: regex });
  }

  // Add the search conditions to the main query if any exist
  if (search_conditions.length > 0) {
    filters["$or"] = search_conditions;
  }

  // low stock amount filter
  let stock_filter = {};
  if (stock_status === "ls") {
    // ls for low stock
    stock_filter = { $gte: ["$low_quantity", "$stock_amount"] };
  }

  //locations
  const selected_locations = locs
    ?.split(",")
    ?.map((loc) => loc.trim()) //remove whitespace
    ?.filter(Boolean) //remove empty values
    || [] //if no selected location
    
  // Initialize locations with the current selected location
  let locations = [new mongoose.Types.ObjectId(location)];

  // Only proceed if there are selected locations
  if (selected_locations.length) {
    const user = await UserModel.findById(req.userId);
    // Get user's location IDs as a Set for faster lookups
    const usersLocationsIds = new Set(
      user.locations.map((item) => item._id?.toString())
    );

    // Filter and convert selected locations to ObjectId, then push them to the locations array
    selected_locations
      .filter((loc) => usersLocationsIds.has(loc.toString())) //check if use has access to the selected location
      .forEach((loc) => locations.push(new mongoose.Types.ObjectId(loc)));
  }

  const userPermissions =
    await hasPermissions(req, [
      "can_view_company_reports",
      "can_create_purchase",
      "can_create_sale",
    ]);

  // call service
  const { data, recordsFiltered = 0 } = await getProductsList({
    // start: s,
    // length: l,
    start: 0,
    length: 100,
    locations,
    filters,
    stock_filter,
    can_view_company_reports: userPermissions['can_view_company_reports'],
    can_create_purchase: userPermissions['can_create_purchase'],
    can_create_sale: userPermissions['can_create_sale'],
  });
  const recordsTotal = await ProductModel.countDocuments({});

  // return response
  return res.status(HTTP_STATUS.OK).json({
    data,
    recordsTotal,
    recordsFiltered,
  });
});

exports.getRecord = catchErrors(async (req, res) => {
  //validate request
  const { id } = req.params;

  // call service
  const product = await ProductModel.findOne({
    _id: id,
    deleted: false,
  });

  //assert record exists
  appAssert(product, HTTP_STATUS.NOT_FOUND, `Record not found`);

  // return response
  return res.status(HTTP_STATUS.OK).json(product);
});

exports.addRecord = catchErrors(async (req, res) => {
  //1, validate request

  //assert there is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );
  let {
    name,
    sku,
    does_expire,
    unit,
    shelf,
    category,
    subcategory,
    low_quantity,
    description,
  } = req.body;
  const image = req.file?.filename;
  const created_by = req.userId;

  //assert required fields
  utils.validateRequiredFields({ name, unit });

  //accept only numbers
  const buying_price = parseFloat(req.body?.buying_price) || null;
  const selling_price = parseFloat(req.body?.selling_price) || null;

  //get expiry setting
  const is_expiry_date_considered = await isExpiryDateConsidered();

  const existing_record = await ProductModel.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, "i") } },
      { sku: { $regex: new RegExp(`^${sku}$`, "i") } },
    ],
  });

  //assert no name or code conflict
  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product with the same name or sku already exists!"
  );

  //2, call a service
  await ProductModel.create({
    name,
    sku,
    unit,
    shelf,
    image,
    category,
    subcategory,
    low_quantity,
    description,
    does_expire: is_expiry_date_considered ? does_expire : false,
    buying_price,
    selling_price,
    created_by,
  });

  //3, return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: `Product created successfully` });
});

exports.updateRecord = catchErrors(async (req, res) => {
  //1, validate request
  const { id } = req.params;

  let {
    name,
    unit,
    shelf,
    category,
    subcategory,
    low_quantity,
    sku,
    description,
    does_expire,
  } = req.body;

  const buying_price = parseFloat(req.body?.buying_price) || null;
  const selling_price = parseFloat(req.body?.selling_price) || null;
  const image = req.file?.filename;
  const updated_by = req.userId;

  //assert required fields
  utils.validateRequiredFields({ name, unit });

  //assert there is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );

  //get expiry setting
  const is_expiry_date_considered = await isExpiryDateConsidered();
  let conditional_data = is_expiry_date_considered ? { does_expire } : {};

  const product = await ProductModel.findOne({ _id: id, deleted: false });
  //assert product is found
  appAssert(product, HTTP_STATUS.NOT_FOUND, `Record not found!`);

  //if there was Product image and now its updated, remove previous image
  if (image && product.image) {
    utils.deleteFile(`uploads/product-images/${product.image}`);
  }

  const existing_record = await ProductModel.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, "i") } },
      { sku: { $regex: new RegExp(`^${sku}$`, "i") } },
    ],
    _id: { $ne: id },
  });

  //assert no name or sku conflict
  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product with the same name or sku already exists!"
  );

  // call service

  const updatedRecord = await ProductModel.findByIdAndUpdate(
    id,
    {
      name,
      sku,
      unit,
      shelf,
      image,
      category,
      subcategory,
      low_quantity,
      buying_price,
      selling_price,
      description,
      updated_by,
      ...conditional_data,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  //assert record found and updated
  appAssert(updatedRecord, HTTP_STATUS.BAD_REQUEST, "Unable to update the product. Please try again later.");

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Product Updated Successfull` });
});

exports.deleteRecord = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  const product = await ProductModel.findOne({
    _id: id,
    deleted: false,
  });

  //assert record exists
  appAssert(product, HTTP_STATUS.BAD_REQUEST, "Record not found!");

  //if there was Product image, delete it
  if (product.image) {
    utils.deleteFile(`uploads/product-images/${product.image}`);
  }
  // call service
  const milliseconds_now = Date.now(); //add unique, if item gets deleted many times

  product.name = `_${product.name}_${milliseconds_now}`;
  product.sku = product.sku
    ? `_${product.sku}_${milliseconds_now}`
    : product.sku;
  product.deleted = true;
  product.deleted_by = req.userId;
  await product.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Product deleted Successfully` });
});
