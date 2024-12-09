const HTTP_STATUS = require("../constants/http");
const UserModel = require("../models/user.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const catchErrors = require("../utils/catchErrors");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

exports.index = catchErrors(async (req, res) => {
  // call service
  const users = await UserModel.find({ deleted: false })
    .select("-password")
    .populate({ path: "created_by", select: "first_name last_name" });

  // return response
  return res.status(HTTP_STATUS.OK).json(users);
});

exports.getMe = catchErrors(async (req, res) => {
  // Fetch the user by their ID from the request object
  const user = await UserModel.findById(req.userId).populate({
    path: "locations.location",
    select: "name",
    match: { deleted: false },
  });

  user.locations = user.locations.filter((loc) => !loc.location.deleted);

  // Assert that the user exists, throw an error if not found
  appAssert(user, HTTP_STATUS.NOT_FOUND, "User not found");

  // Return the user data without the password
  return res.status(HTTP_STATUS.OK).json(user.omitStructure());
});

exports.createUser = catchErrors(async (req, res) => {
  // validate request
  let {
    first_name,
    last_name,
    phone,
    password,
    confirm_password,
    role,
    locations,
    is_active,
  } = req.body;
  locations = JSON.parse(locations);

  // call service
  const user = await UserModel.register({
    req,
    first_name,
    last_name,
    phone,
    password,
    confirm_password,
    is_active,
    locations,
    role,
  });

  // return response
  res.status(HTTP_STATUS.CREATED).json({
    message: `An Account for ${user.fullname} has been created successfully`,
  });
});

exports.getUser = catchErrors(async (req, res) => {
  // call service
  const { id } = req.params;
  const user = await UserModel.findOne({
    _id: id,
    deleted: false,
  })
    .select("-password")
    .populate({
      path: "locations.location",
      select: "name deleted",
    });

  user.locations = user.locations.filter((loc) => !loc.location?.deleted);

  appAssert(user, HTTP_STATUS.NOT_FOUND, "User's account not found");

  // return response
  return res.status(HTTP_STATUS.OK).json(user);
});

exports.updateUser = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  let { first_name, last_name, phone, role, locations, is_active } = req.body;
  console.log({ locations });

  locations = JSON.parse(locations);
  console.log(locations);
  

  //assert thier is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );
  const path = req.file?.path;

  //validate ids, preventing undefined
  locations = locations.filter((location_id) =>
    mongoose.Types.ObjectId.isValid(location_id)
  );

  //assert required fields
  utils.validateRequiredFields({
    first_name,
    phone,
    role,
  });

  //assert atleast one location is selected
  appAssert(
    locations?.length >= 1,
    HTTP_STATUS.BAD_REQUEST,
    "Please assign at least one location."
  );

  //assert phone number is valid
  appAssert(
    utils.checkPhoneNumberValidity(phone),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid Phone Number!"
  );

  //assert no other user is using the phone number
  const prevUser = await UserModel.findOne({ phone, _id: { $ne: id } });
  appAssert(!prevUser, HTTP_STATUS.BAD_REQUEST, "phone number already in use!");

  // assert user exists
  const user = await UserModel.findOne({ _id: id, deleted: false });
  appAssert(user, HTTP_STATUS.BAD_REQUEST, "Account not found!");

  //change users image
  if (path && user.profileImg) {
    //if there was profile profile Image and its updated, remove previous image
    utils.deleteFile(user.profileImg);
  }

  // Retrieve the current location
  const currentLoc = user.locations?.find((loc) => loc.isCurrent)?.location;

  // Check if the current location is not removed
  const isCurrentLocationAvailable =
    currentLoc && locations.includes(new ObjectId(currentLoc).toString());

  // Format the locations
  let formattedLocations = locations.map((location, idx) => {
    return {
      location,
      isCurrent: isCurrentLocationAvailable
        ? currentLoc.equals(location)
        : idx === 0,
    };
  });

  // call service
  await UserModel.findByIdAndUpdate(
    id,
    {
      first_name,
      last_name,
      phone,
      role,
      locations: formattedLocations,
      is_active,
      profileImg: path?.replace(/\\/g, "/"),
      updated_by: req.userId,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `The user's account has been successfully updated.`,
  });
});

exports.deleteUser = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  const user = await UserModel.findOne({ _id: id, deleted: false });
  appAssert(user, HTTP_STATUS.BAD_REQUEST, "Account not found!");

  // call service
  const milliseconds_now = Date.now(); //add unique, if item gets deleted many times

  user.phone = `_${user.phone}_${milliseconds_now}`;
  user.deleted = true;
  user.deleted_by = req.userId;
  await user.save();

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `${user.first_name}'s account has been successfully deleted.`,
  });
});
