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
  const query = req.query.query;
  // call service
  const products = await ProductModel.find({
    $or: [
      { name: new RegExp(query, "i") },
      { sku: new RegExp(query, "i") },
      { shelf: new RegExp(query, "i") },
    ],
    deleted: false,
  })
    .select("name sku")
    .limit(10);

  // return response
  return res.status(HTTP_STATUS.OK).json(products);
});

exports.getRecords = catchErrors(async (req, res) => {
  // validate request
  const {
    q, //search query
    page, //page
    show, //length
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
    //low stock
    // ls for low stock
    stock_filter = { $gte: ["$low_quantity", "$stock_amount"] };
  } else if (stock_status === "hs") {
    //has stock
    stock_filter = { $gte: ["$stock_amount", 1] };
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

  const userPermissions = await hasPermissions(req, [
    "can_view_company_reports",
    "can_create_purchase",
    "can_create_sale",
  ]);

  // call service
  const { data: products, recordsFiltered = 0 } = await getProductsList({
    page,
    show,
    locations,
    filters,
    stock_filter,
    can_view_company_reports: userPermissions["can_view_company_reports"],
    can_create_purchase: userPermissions["can_create_purchase"],
    can_create_sale: userPermissions["can_create_sale"],
  });
  const recordsTotal = await ProductModel.countDocuments({});

  // return response
  return res.status(HTTP_STATUS.OK).json({
    products,
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
  }).select(
    "name sku image shelf unit category low_quantity buying_price selling_price does_expire description"
  );

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
  let { name, sku, does_expire, shelf, low_quantity, description,buying_price,selling_price } = req.body;

  //1.1 avoid empty strings
  const unit = utils.normalize(req.body?.unit);
  const category = utils.normalize(req.body?.category);
  const subcategory = utils.normalize(req.body?.subcategory);
  const image = req.file?.filename;
  const created_by = req.userId;

  //1.3 validate numeric fields, [no required field ] 👇
  utils.validateNumberFields({buying_price, selling_price, low_quantity})

  //1.3 assert required fields
  utils.validateRequiredFields({ name, unit });

  //1.4 assert no name or code conflict
  const existing_record = await ProductModel.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, "i") } },
      { sku: { $regex: new RegExp(`^${sku}$`, "i"), $ne: null } },
    ],
  });

  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product with the same name or sku already exists!"
  );

  // 1.5 Check if expiry date is enabled; if not, expiry date won't be saved.
  const is_expiry_date_considered = await isExpiryDateConsidered();

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

  //1.1 assert there is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );

  const { id } = req.params;
  let { name, shelf, low_quantity, sku, description, does_expire,buying_price, selling_price } = req.body;

  //1.2 avoid empty strings
  const unit = utils.normalize(req.body?.unit);
  const category = utils.normalize(req.body?.category);
  const subcategory = utils.normalize(req.body?.subcategory);
  const image = req.file?.filename;
  const updated_by = req.userId;

  //1.3 validate numeric fields, [no required field ] 👇
  utils.validateNumberFields({buying_price, selling_price, low_quantity})

  //1.4 assert required fields
  utils.validateRequiredFields({ name, unit });

  //1.5 assert product exists
  const product = await ProductModel.findOne({ _id: id, deleted: false });
  appAssert(product, HTTP_STATUS.NOT_FOUND, `Record not found!`);

  //1.6 assert no name or sku conflict
  const existing_record = await ProductModel.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, "i") } },
      { sku: { $regex: new RegExp(`^${sku}$`, "i") } },
    ],
    _id: { $ne: id },
  });

  appAssert(
    !existing_record,
    HTTP_STATUS.BAD_REQUEST,
    "Product with the same name or sku already exists!"
  );

  //2. call service
  let updateQuery = {
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
    does_expire,
  };

  // 1.6 if expiry date is not considered, don't update the 'does_expire' value
  const is_expiry_date_considered = await isExpiryDateConsidered();
  if (!is_expiry_date_considered) {
    delete updateQuery.does_expire;
  }

  //2.1 update the product record
  const updatedRecord = await ProductModel.findByIdAndUpdate(id, updateQuery, {
    new: true,
    runValidators: true,
  });

  //assert record found and updated
  appAssert(
    updatedRecord,
    HTTP_STATUS.BAD_REQUEST,
    "Unable to update the product. Please try again later."
  );

  // 2.2 If a product image exists and is being updated, delete the previous image.
  if (image && product.image) {
    utils.deleteFile(`uploads/product-images/${product.image}`);
  }

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Product Updated Successfull` });
});

exports.deleteRecord = catchErrors(async (req, res) => {
  //1. validate request
  const { id } = req.params;
  const product = await ProductModel.findOne({
    _id: id,
    deleted: false,
  });

  //1.1 assert record exists
  appAssert(product, HTTP_STATUS.BAD_REQUEST, "Record not found!");

  //2 call service
  //2.1 if there is Product image, delete it
  if (product.image) {
    utils.deleteFile(`uploads/product-images/${product.image}`);
  }

  //2.2 mark product as deleted
  const milliseconds_now = Date.now();
  product.name = `_${product.name}_${milliseconds_now}`;
  product.sku = `_${product.sku}_${milliseconds_now}`;
  product.deleted = true;
  product.deleted_by = req.userId;
  await product.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Product deleted Successfully` });
});
