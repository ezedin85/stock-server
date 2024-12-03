const { verifyToken } = require("../utils/jwt");
const AppErrorCode = require("../constants/appErrorCodes");
const HTTP_STATUS = require("../constants/http");
const appAssert = require("../utils/appAssert");

// wrap with catchErrors() if you need this to be async
const authenticate = (req, res, next) => {
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

  req.userId = payload.userId;
  req.sessionId = payload.sessionId;
  next();
};

module.exports = authenticate;
