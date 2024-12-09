const AppErrorCode = {
  InvalidAccessToken: "InvalidAccessToken", // Used with a 401 status to prompt a request for a new access token
  ACCOUNT_INACTIVE_OR_NOT_FOUND: "ACCOUNT_INACTIVE_OR_NOT_FOUND", // Used to clear user's cookies
  LOCATION_CHANGED: "LOCATION_CHANGED", // Used to clear user's cookies
};

module.exports = AppErrorCode;
