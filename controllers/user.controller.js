const HTTP_STATUS = require("../constants/http");
const UserModel = require("../models/user.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const catchErrors = require("../utils/catchErrors");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");

exports.index = catchErrors(async (req, res) => {
  // call service
  const users = await UserModel.find({ deleted: false })
    .select("-password")
    .populate([
      {
        path: "created_by",
        select: "first_name last_name",
      },
      {
        path: "updated_by",
        select: "first_name last_name",
      },
      {
        path: "locations.location",
        select: "name",
      },
      {
        path: "role",
        select: "role_name",
      },
    ]);

  // return response
  return res.status(HTTP_STATUS.OK).json(users);
});

exports.getMe = catchErrors(async (req, res) => {
  // Fetch the user by their ID from the request object
  const user = await UserModel.findById(req.userId)
    .populate([
      {
        path: "locations.location",
        select: "name deleted",
      },
      {
        path: "role",
        select: "permissions",
        populate: { path: "permissions", select: "code_name -_id" },
      },
    ])
    .select("first_name last_name phone locations role profileImg");

  user.locations = user.locations.filter((loc) => !loc?.location?.deleted);

  // Assert that the user exists, throw an error if not found
  appAssert(user, HTTP_STATUS.NOT_FOUND, "User not found");

  // Return the user data without the password
  return res.status(HTTP_STATUS.OK).json(user);
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

  locations = JSON.parse(locations);

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

exports.updateOwnProfile = catchErrors(async (req, res) => {
  // validate request
  let { first_name, last_name, phone } = req.body;

  //assert thier is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );
  const path = req.file?.path;

  //assert required fields
  utils.validateRequiredFields({
    first_name,
    phone,
  });

  //assert phone number is valid
  appAssert(
    utils.checkPhoneNumberValidity(phone),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid Phone Number!"
  );

  //assert no other user is using the phone number
  const prevUser = await UserModel.findOne({ phone, _id: { $ne: req.userId } });
  appAssert(!prevUser, HTTP_STATUS.BAD_REQUEST, "phone number already in use!");

  //find user
  const user = await UserModel.findOne({ _id: req.userId });

  // call service
  //if there was profile profile Image and its updated, remove previous image
  if (path && user.profileImg) {
    utils.deleteFile(user.profileImg);
  }

  // call service
  await UserModel.findByIdAndUpdate(
    req.userId,
    {
      first_name,
      last_name,
      phone,
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
    message: `Profile updated successfully.`,
  });
});

exports.changeLocation = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.body;

  //assert user has the location
  const user = await UserModel.findById(req.userId).populate(
    "locations.location"
  );
  //find user location ids
  //check if user has access to send location and its not delted
  const hasUserAccessToTheLocation = user.locations.some(
    (loc) => !loc.location.deleted && loc.location._id.equals(id)
  );

  appAssert(
    hasUserAccessToTheLocation,
    HTTP_STATUS.BAD_REQUEST,
    "Unable to change Location!"
  );

  // call service
  //Update the current location
  user.locations = user.locations.map((loc) => ({
    ...loc,
    isCurrent: loc.location._id.equals(id),
  }));
  await user.save();

  const newCurrentLocation = user.locations.find(
    (loc) => loc.isCurrent && !loc.location?.deleted
  );

  // return response
  return res.status(HTTP_STATUS.OK).json({
    newLocation: id,
    message: `Success! You are now at ${newCurrentLocation.location.name} ${newCurrentLocation.location.location_type}.`,
  });
});

exports.changeOwnPassword = catchErrors(async (req, res) => {
  // validate request
  const { currentPassword, newPassword, confirmPassword } = req.body;

  //assert password is atleast 6 characters!
  appAssert(
    newPassword.length >= 6,
    HTTP_STATUS.BAD_REQUEST,
    "Password length must be atleast 6 characters!"
  );

  //asser passwords match
  appAssert(
    newPassword === confirmPassword,
    HTTP_STATUS.BAD_REQUEST,
    "Passwords don't match!"
  );

  //find user
  const user = await UserModel.findOne({ _id: req.userId, deleted: false });

  const match = await bcrypt.compare(currentPassword, user.password);

  //asser prev password matches
  appAssert(
    match,
    HTTP_STATUS.BAD_REQUEST,
    "The password you entered as a previous password is not correct"
  );

  // call service
  //hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPwd = await bcrypt.hash(newPassword, salt);

  user.password =hashedPwd;
  user.updated_by = req.userId
  await user.save()

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Password changed successfully.`,
  });
});
