const mongoose = require("mongoose");
const utils = require("../utils/utils");
const appAssert = require("../utils/appAssert");
const bcrypt = require("bcrypt");
const HTTP_STATUS = require("../constants/http");

const userSchema = new mongoose.Schema(
  {
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      trim: true,
    },
    is_super_admin: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    password: { type: String, required: true },
    is_active: {
      type: Boolean,
      default: false,
      required: true,
    },
    locations: [
      {
        location: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Location",
        },
        isCurrent: { type: Boolean, default: false },
      },
    ],
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      // required: [true, "Role is required"],
    },
    profileImg: String,
    tgChatId: String,
    socketIds: [String],
    deleted: { type: Boolean, default: false },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deleted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Method to omit the password from the returned user object
userSchema.methods.omitPassword = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

// userSchema.methods.omitStructure = function () {
//   const user = this.toObject();
//   const fieldsToOmit = [
//     'password', 'socketIds',
//     'deleted', 'deleted_by',
//   ];

//   fieldsToOmit.forEach(field => delete user[field]);

//   return user;
// };

userSchema.statics.register = async function ({
  req,
  first_name,
  last_name,
  tgChatId,
  is_active,
  locations,
  phone,
  password,
  confirm_password,
  role,
}) {
  //1.1 assert there is no file upload error
  appAssert(
    !req.fileValidationError,
    HTTP_STATUS.BAD_REQUEST,
    req.fileValidationError
  );

  //1.2 assert required fiedls
  utils.validateRequiredFields({
    first_name,
    phone,
    password,
    confirm_password,
    role,
  });

  //validate ids, preventing undefined
  locations = locations.filter((location_id) =>
    mongoose.Types.ObjectId.isValid(location_id)
  );

  //1.3 assert atleast one location is selected
  appAssert(
    locations?.length >= 1,
    HTTP_STATUS.BAD_REQUEST,
    "Please assign at least one location."
  );

  //set one location as current
  let formatted_locations = locations.map((location, idx) => ({
    location,
    isCurrent: idx === 0,
  }));

  //1.4 assert phone number is valid
  appAssert(
    utils.checkPhoneNumberValidity(phone),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid Phone Number!"
  );

  //assert no user is using the phone number
  const prevUser = await this.findOne({ phone });
  appAssert(!prevUser, HTTP_STATUS.BAD_REQUEST, "phone number already in use!");

  //assert password is atleast 6 characters!
  appAssert(
    password.length >= 6,
    HTTP_STATUS.BAD_REQUEST,
    "Password length must be atleast 6 characters!"
  );

  //assert passwords match
  appAssert(
    password === confirm_password,
    HTTP_STATUS.BAD_REQUEST,
    "Passwords don't match!"
  );

  //hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPwd = await bcrypt.hash(password, salt);

  const created_by = req.userId;
  await this.create({
    first_name,
    last_name,
    tgChatId,
    phone,
    is_active,
    password: hashedPwd,
    locations: formatted_locations,
    role,
    created_by,
    profileImg: req.file?.path?.replace(/\\/g, "/"),
  });
  return { fullname: `${first_name + " " + last_name}` };
};

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
