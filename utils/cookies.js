const { oneDayFromNow, fiveMinutesFromNow } = require("./date");

const REFRESH_PATH = "/auth/refresh";

const defaults = {
  sameSite: "strict",
  httpOnly: true, // will not be exposed to JavaScript running on the client side [eg. document.cookie].
  secure: process.env.NODE_ENV !== "development", // in production https is required
};

const getAccessTokenCookieOptions = () => ({
  ...defaults,
  expires: fiveMinutesFromNow(),
});

const getRefreshTokenCookieOptions = () => ({
  ...defaults,
  expires: oneDayFromNow(),
  path: REFRESH_PATH, // restrict the cookie to be sent back only in REFRESH_PATH
});

const setAuthCookies = ({ res, accessToken, refreshToken }) =>
  res
    .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
    .cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

const clearAuthCookies = (res) =>
  res
    .clearCookie("accessToken")
    .clearCookie("refreshToken", { path: REFRESH_PATH });

    
module.exports = {
  setAuthCookies,
  clearAuthCookies,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  REFRESH_PATH,
};
