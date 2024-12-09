const SessionModel = require("../models/session.model");
const LocationModel = require("../models/location.model");
const UserModel = require("../models/user.model");
const appAssert = require("../utils/appAssert");
const { fiveMinutesFromNow, oneDayFromNow } = require("../utils/date");
const HTTP_STATUS = require("../constants/http");
const {
  refreshTokenSignOptions,
  signToken,
  verifyToken,
} = require("../utils/jwt");
const { compareValue } = require("../utils/bcrypt");

const loginUser = async ({ phone, password, userAgent }) => {
  // Find user by phone
  const user = await UserModel.findOne({ phone }).populate(
    "locations.location"
  );

  // Assert user exists AND is not deleted
  appAssert(
    user && !user.deleted,
    HTTP_STATUS.UNAUTHORIZED,
    "Invalid phone number or password"
  );

  // Check if password is correct
  const isValid = await compareValue(password, user.password);
  appAssert(
    isValid,
    HTTP_STATUS.UNAUTHORIZED,
    "Invalid phone number or password"
  );

  // check if user's account is active
  appAssert(
    user.is_active,
    HTTP_STATUS.UNAUTHORIZED,
    "Your account is inactive. Please contact the administrator for assistance."
  );

  const userId = user._id;

  //# check current locaiton is not deleted, if so assign new current location
  // find current location
  const currentLocationEntry = user.locations.find(
    (loc) => loc.isCurrent && !loc.location?.deleted
  );

  console.log({ currentLocationEntry });
  if (!currentLocationEntry) {
    // Step 4: Find another location to set as current
    const newCurrentLocationEntry = user.locations.find(
      (loc) => !loc.location?.deleted
    );

    //asser user has other undeleted locations
    appAssert(newCurrentLocationEntry, HTTP_STATUS.BAD_REQUEST, "You have not been assigned to any location");

    //Update the current location
    user.locations = user.locations.map(loc => ({
      ...loc,
      isCurrent: loc.location._id.equals(newCurrentLocationEntry.location._id)
    }));


    await user.save(); // Save the updated user

    console.log(`🔴`);
    console.log(user);
    
  }


  // Create a session
  const session = await SessionModel.create({
    userId,
    userAgent,
  });

  // Define the session information to include in the refresh token
  const sessionInfo = {
    sessionId: session._id,
  };

  //sign access token
  const refreshToken = signToken(sessionInfo, refreshTokenSignOptions);

  // sign refresh token
  const accessToken = signToken({ ...sessionInfo, userId });

  return {
    user: user.omitPassword(), // Omitting password before sending user data
    accessToken,
    refreshToken,
  };
};

const refreshUserAccessToken = async (refreshToken) => {
  const { payload } = verifyToken(refreshToken, {
    secret: refreshTokenSignOptions.secret,
  });
  appAssert(payload, HTTP_STATUS.UNAUTHORIZED, "Invalid Refresh token");

  // check if users current session exists in db [not deleted] & not expired
  const session = await SessionModel.findById(payload.sessionId);
  const now = Date.now();
  appAssert(
    session && session.expiresAt.getTime() > now,
    HTTP_STATUS.UNAUTHORIZED,
    "Session Expired"
  );

  //generate new access token
  const accessToken = signToken({
    userId: session.userId,
    sessionId: session._id,
  });

  return { accessToken };
};

module.exports = {
  loginUser,
  refreshUserAccessToken,
};
