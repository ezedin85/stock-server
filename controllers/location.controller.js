const HTTP_STATUS = require("../constants/http");
const LocationModel = require("../models/location.model");
const appAssert = require("../utils/appAssert");
const catchErrors = require("../utils/catchErrors");
const { LOCATION_TYPES } = require("../constants/constants");
const utils = require("../utils/utils");

exports.index = catchErrors(async (req, res) => {
  // call service
  const locations = await LocationModel.find({
    deleted: false,
  }).populate({
    path: "created_by",
    select: "first_name last_name",
  });

  // return response
  return res.status(HTTP_STATUS.OK).json(locations);
});

exports.getLocations = catchErrors(async (req, res) => {
  // validate request
  const { location_type } = req.params;
  appAssert(
    LOCATION_TYPES.includes(location_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Location Type"
  );

  // call service
  const locations = await LocationModel.find({
    location_type,
    deleted: false,
  }).populate({
    path: "created_by",
    select: "first_name last_name",
  });

  // return response
  return res.status(HTTP_STATUS.OK).json(locations);
});

exports.getLocation = catchErrors(async (req, res) => {
  // call service
  const { id, location_type } = req.params;
  appAssert(
    LOCATION_TYPES.includes(location_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Location Type"
  );

  const location = await LocationModel.findOne({
    _id: id,
    location_type,
    deleted: false,
  });

  appAssert(location, HTTP_STATUS.NOT_FOUND, `${location_type} not found`);

  // return response
  return res.status(HTTP_STATUS.OK).json(location);
});

exports.addRecord = catchErrors(async (req, res) => {
  // validate request
  const { location_type } = req.params;
  const { name } = req.body;
  const created_by = req.userId;

  //assert location type
  appAssert(
    LOCATION_TYPES.includes(location_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Location Type"
  );

  //assert required fields
  utils.validateRequiredFields({ name });

  const existing_location = await LocationModel.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  //assert no name conflict
  appAssert(
    !existing_location,
    HTTP_STATUS.BAD_REQUEST,
    "Location names must be unique. This name is already taken"
  );

  // call service
  await LocationModel.create({ name, location_type, created_by });

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: `${location_type} created successfully` });
});

exports.updateRecord = catchErrors(async (req, res) => {
  // validate request
  const { location_type, id } = req.params;
  const { name } = req.body;
  const updated_by = req.userId;

  //assert location type
  appAssert(
    LOCATION_TYPES.includes(location_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Location Type"
  );

  //assert required fields
  utils.validateRequiredFields({ name });

  const existing_location = await LocationModel.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    _id: { $ne: id },
  });

  //assert no name conflict
  appAssert(
    !existing_location,
    HTTP_STATUS.BAD_REQUEST,
    "Location names must be unique. This name is already taken"
  );

  // call service
  const updatedRecord = await LocationModel.findByIdAndUpdate(
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

  //assert location found and updated
  appAssert(updatedRecord, HTTP_STATUS.BAD_REQUEST, "Location not found!");

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${location_type} Updated Successfull` });
});

exports.deleteRecord = catchErrors(async (req, res) => {
  // validate request
  const { location_type, id } = req.params;
  appAssert(
    LOCATION_TYPES.includes(location_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Location Type"
  );

  const location = await LocationModel.findOne({ _id: id, deleted: false });
  //assert location exists
  appAssert(location, HTTP_STATUS.BAD_REQUEST, "Location not found!");

  // call service
  const milliseconds_now = Date.now(); //add unique, if item gets deleted many times
  location.name = `_${location.name}_${milliseconds_now}`;
  location.deleted = true;
  location.deleted_by = req.userId;
  await location.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${location_type} deleted Successfully` });
});