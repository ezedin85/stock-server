const HTTP_STATUS = require("../constants/http");
const UserModel = require("../models/user.model");
const NotificationModel = require("../models/notification.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const catchErrors = require("../utils/catchErrors");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");

exports.index = catchErrors(async (req, res) => {
  // call service
  const users = await UserModel.find({ deleted: false })
    .select("-password -socketIds -deleted -deleted_by")
    .populate([
      { path: "created_by updated_by", select: "first_name last_name" },
      { path: "locations.location", select: "name", match: { deleted: false } },
      { path: "role", select: "role_name" },
    ]);

  // return response
  return res.status(HTTP_STATUS.OK).json(users);
});

exports.getUserNameList = catchErrors(async (req, res) => {
  // call service
  const users = await UserModel.find({
    deleted: false,
    is_active: true,
  }).select("first_name last_name");
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

  //remove deleted locations
  user.locations = user.locations.filter((loc) => !loc?.location?.deleted);

  // Assert that the user exists, throw an error if not found
  appAssert(user, HTTP_STATUS.NOT_FOUND, "User not found");

  // Return data
  return res.status(HTTP_STATUS.OK).json(user);
});

exports.createUser = catchErrors(async (req, res) => {
  // validate request
  let {
    first_name,
    last_name,
    tgChatId,
    phone,
    password,
    confirm_password,
    role,
    locations,
    is_active,
  } = req.body;
  // Convert the stringified array back into an array
  locations = JSON.parse(locations);

  // call service
  const user = await UserModel.register({
    req,
    first_name,
    last_name,
    tgChatId,
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
    .select(
      "first_name last_name phone tgChatId is_active locations role profileImg"
    )
    .populate({
      path: "locations.location",
      select: "name deleted",
    });

  //remove deleted locations
  user.locations = user.locations.filter((loc) => !loc?.location?.deleted);

  //assert user exists
  appAssert(user, HTTP_STATUS.NOT_FOUND, "Record not found");

  // return response
  return res.status(HTTP_STATUS.OK).json(user);
});

exports.updateUser = catchErrors(async (req, res) => {
  //1. validate request
  const { id } = req.params;
  let { first_name, last_name, tgChatId, phone, role, locations, is_active } =
    req.body;

  // Convert the stringified array back into an array
  locations = JSON.parse(locations);

  //1.1 assert there is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );
  const path = req.file?.path;

  //1.2 validate ids, preventing undefined
  locations = locations.filter((location_id) =>
    mongoose.Types.ObjectId.isValid(location_id)
  );

  //1.3 assert required fields
  utils.validateRequiredFields({
    first_name,
    phone,
    role,
  });

  //1.4 assert atleast one location is selected
  appAssert(
    locations?.length >= 1,
    HTTP_STATUS.BAD_REQUEST,
    "Please assign at least one location."
  );

  //1.5 assert phone number is valid
  appAssert(
    utils.checkPhoneNumberValidity(phone),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid Phone Number!"
  );

  //1.6 assert no other user is using the phone number
  const prevUser = await UserModel.findOne({ phone, _id: { $ne: id } });
  appAssert(!prevUser, HTTP_STATUS.BAD_REQUEST, "phone number already in use!");

  //1.7 assert user exists
  const user = await UserModel.findOne({ _id: id, deleted: false });
  appAssert(user, HTTP_STATUS.BAD_REQUEST, "Account not found!");

  // 1.8 If the user's current location is removed, assign a new current location.
  // Note: The user will be logged out on their first API call.
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
  //2.1 update user's account
  await UserModel.findByIdAndUpdate(
    id,
    {
      first_name,
      last_name,
      tgChatId,
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

  // 2.2 If a new profile image is provided, delete the previous image from storage
  if (path && user.profileImg) {
    utils.deleteFile(user.profileImg);
  }

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

  //2 call service

  //2.1 mark users acccount as deleted
  const milliseconds_now = Date.now();
  user.phone = `_${user.phone}_${milliseconds_now}`;
  user.deleted = true;
  user.deleted_by = req.userId;
  await user.save();

  // 2.2 If a user had profile image, delete the image.
  if (user.profileImg) {
    utils.deleteFile(user.profileImg);
  }

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `${user.first_name}'s account has been successfully deleted.`,
  });
});

exports.updateOwnProfile = catchErrors(async (req, res) => {
  //1 validate request
  let { first_name, last_name, phone } = req.body;

  //1.1 assert thier is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );
  const path = req.file?.path;

  //1.2 assert required fields
  utils.validateRequiredFields({
    first_name,
    phone,
  });

  //1.2 assert phone number is valid
  appAssert(
    utils.checkPhoneNumberValidity(phone),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid Phone Number!"
  );

  //1.3 assert no other user is using the phone number
  const prevUser = await UserModel.findOne({ phone, _id: { $ne: req.userId } });
  appAssert(!prevUser, HTTP_STATUS.BAD_REQUEST, "phone number already in use!");

  //2 call service
  // 2.1 Retrieve the user's account to access existing data (e.g., profile image)
  const user = await UserModel.findOne({ _id: req.userId });

  //2.1 update users account
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

  // 2.2 If a new profile image is provided, delete the previous image from storage
  if (path && user.profileImg) {
    utils.deleteFile(user.profileImg);
  }

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Profile updated successfully.`,
  });
});

exports.changeLocation = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.body;

  // Ensure the user has permission to access the provided location
  const user = await UserModel.findById(req.userId).populate(
    "locations.location"
  );
  const hasUserAccessToTheLocation = user.locations.some(
    (loc) => !loc.location?.deleted && loc?.location?._id?.equals(id)
  );

  appAssert(
    hasUserAccessToTheLocation,
    HTTP_STATUS.BAD_REQUEST,
    "You do not have permission to access this location! Location change denied!"
  );

  // call service
  //Update the current location
  user.locations = user.locations.map((loc) => ({
    ...loc,
    isCurrent: loc.location?._id?.equals(id),
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

  //1.1 assert password is atleast 6 characters!
  appAssert(
    newPassword.length >= 6,
    HTTP_STATUS.BAD_REQUEST,
    "Password length must be atleast 6 characters!"
  );

  //1.2 assert passwords match
  appAssert(
    newPassword === confirmPassword,
    HTTP_STATUS.BAD_REQUEST,
    "Passwords don't match!"
  );

  //1.3 Verify that the previous password matches
  const user = await UserModel.findOne({ _id: req.userId, deleted: false });
  const match = await bcrypt.compare(currentPassword, user.password);
  appAssert(
    match,
    HTTP_STATUS.BAD_REQUEST,
    "The password you entered as a previous password is not correct"
  );

  // assert new password is not as same as the old one
  appAssert(
    currentPassword !== newPassword,
    HTTP_STATUS.BAD_REQUEST,
    "The new password must be different from the old one!"
  );

  //2. call service
  //2.1 hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPwd = await bcrypt.hash(newPassword, salt);

  user.password = hashedPwd;
  user.updated_by = req.userId;
  await user.save();

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Password changed successfully.`,
  });
});

exports.changeUserPassword = catchErrors(async (req, res) => {
  // validate request
  const { newPassword, confirmPassword } = req.body;

  const { id } = req.params;

  //1.1 assert password is atleast 6 characters!
  appAssert(
    newPassword.length >= 6,
    HTTP_STATUS.BAD_REQUEST,
    "Password length must be atleast 6 characters!"
  );

  //1.2 assert passwords match
  appAssert(
    newPassword === confirmPassword,
    HTTP_STATUS.BAD_REQUEST,
    "Passwords don't match!"
  );

  const user = await UserModel.findOne({ _id: id, deleted: false });
  //1.3 assert user exists
  appAssert(user, HTTP_STATUS.NOT_FOUND, "User not found!");

  //2. call service
  const salt = await bcrypt.genSalt(10);
  const hashedPwd = await bcrypt.hash(newPassword, salt);

  user.password = hashedPwd;
  user.updated_by = req.userId;
  await user.save();

  // return response
  return res.status(HTTP_STATUS.OK).json({
    message: `Password changed successfully.`,
  });
});

exports.getMyNotifications = catchErrors(async (req, res) => {
  // validate request

  // call service
  const notifications = await NotificationModel.find({
    notifiable_user_id: req.userId,
  });

  // return response
  return res.status(HTTP_STATUS.OK).json(notifications);
});
