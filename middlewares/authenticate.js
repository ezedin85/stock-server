const { verifyToken } = require("../utils/jwt");
const AppErrorCode = require("../constants/appErrorCodes");
const HTTP_STATUS = require("../constants/http");
const appAssert = require("../utils/appAssert");
const catchErrors = require("../utils/catchErrors");
const UserModel = require("../models/user.model");
const SessionModel = require("../models/session.model");
const LocationModel = require("../models/location.model");
const { clearAuthCookies } = require("../utils/cookies");
const AppError = require("../utils/AppError");

// wrap with catchErrors() if you need this to be async
const authenticate = catchErrors(async (req, res, next) => {
  const accessToken = req.cookies.accessToken;

  appAssert(
    accessToken,
    HTTP_STATUS.UNAUTHORIZED,
    "Not authorized",
    AppErrorCode.InvalidAccessToken
  );

  const { error, payload } = verifyToken(accessToken);

  appAssert(
    payload,
    HTTP_STATUS.UNAUTHORIZED,
    error === "jwt expired" ? "Token expired" : "Invalid token",
    AppErrorCode.InvalidAccessToken //will be used to trigger refresh access token request api
  );

  //find the user
  const user = await UserModel.findById(payload.userId);

  //Assert user exists in db, and is active and is not deleted
  appAssert(
    user && user.is_active && !user.deleted,
    HTTP_STATUS.UNAUTHORIZED,
    "Your session has ended. Please log in again.",
    AppErrorCode.ACCOUNT_INACTIVE_OR_NOT_FOUND
  );

  //asserth current location is sent
  const userCurrentLocId = req.headers["x-current-location"];

  //get users actual current location
  const actualCurrentLoc = user.locations?.find(
    (loc) => loc.isCurrent
  )?.location;

  //compare user's sent location with actual current location
  const locationInSync = actualCurrentLoc?.equals(userCurrentLocId);

  const location = await LocationModel.findOne({
    _id: actualCurrentLoc,
    deleted: false,
  });

  // Verify that the current location exists, has not been deleted,
  // and is properly synchronized with the location the user is viewing.
  if (!location || !locationInSync) {
    await SessionModel.findByIdAndDelete(payload.sessionId); //remove current session
    clearAuthCookies(res); //clear cookies

    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      "The previous request could not be completed. because your location has been changed or not been found.",
      AppErrorCode.LOCATION_CHANGED
    );
  }

  req.userId = payload.userId;
  req.currentLocation = actualCurrentLoc;
  req.sessionId = payload.sessionId;
  next();
});

module.exports = authenticate;
