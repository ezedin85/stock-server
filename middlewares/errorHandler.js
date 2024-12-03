const HTTP_STATUS = require("../constants/http");
const AppError = require("../utils/AppError");
const { REFRESH_PATH, clearAuthCookies } = require("../utils/cookies");


// custom thrown errors handler
const handleAppError = (res, err) => {
  return res.status(err.statusCode).json({
    message: err.message,
    errorCode: err.errorCode,
  });
};

const errorHandler = (err, req, res, next) => {
  console.log(`🔸PATH: ${req.path}`, err);

  //if an error occured [eg. session expiry, no session]
  // while refreshing, clear the cookies
  if (req.path === REFRESH_PATH) {
    clearAuthCookies(res);
  }

  if (err instanceof AppError) {
    return handleAppError(res, err);
  }

  return res
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .send("Internal Server Error");
};

module.exports = errorHandler;
