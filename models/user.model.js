const mongoose = require("mongoose");
const { compareValue, hashValue } = require("../utils/bcrypt");

const userSchema = new mongoose.Schema(
  {
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

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
