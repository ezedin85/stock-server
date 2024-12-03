const HTTP_STATUS = require("../constants/http");
const UserModel = require("../models/user.model");
const appAssert = require("../utils/appAssert");
const catchErrors = require("../utils/catchErrors");

const getUserHandler = catchErrors(async (req, res) => {
  // Fetch the user by their ID from the request object
  const user = await UserModel.findById(req.userId);

  // Assert that the user exists, throw an error if not found
  appAssert(user, HTTP_STATUS.NOT_FOUND, "User not found");

  // Return the user data without the password
  return res.status(HTTP_STATUS.OK).json(user.omitPassword());
});

module.exports = { getUserHandler };
