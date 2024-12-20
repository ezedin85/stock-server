const UAParser = require('ua-parser-js');
const catchErrors = require("../utils/catchErrors");
const {
  loginUser,
  refreshUserAccessToken,
} = require("../services/auth.services");
const HTTP_STATUS = require("../constants/http");
const {
  setAuthCookies,
  clearAuthCookies,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} = require("../utils/cookies");

const { verifyToken } = require("../utils/jwt");
const SessionModel = require("../models/session.model");
const appAssert = require("../utils/appAssert");
const mongoose = require("mongoose");

const loginHandler = catchErrors(async (req, res) => {
  // validate request
  const { phone, password } = req.body;
  
  // 1️⃣ Get IP
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // 2️⃣ Get Device, Browser, and OS
  const userAgent = req.headers["user-agent"];
  const parser = new UAParser(userAgent);
  const device = parser.getDevice()?.type || 'Desktop';
  const browser = parser.getBrowser()?.name;
  const os = parser.getOS()?.name;


  // call service
  const { user, accessToken, refreshToken } = await loginUser({
    phone,
    password,
    userAgent,
    ip,
    device,
    browser,
    os
  });
  
  const currentLocation = user.locations?.find((loc) => loc.isCurrent)?.location?._id;

  // return response
  return setAuthCookies({ res, accessToken, refreshToken })
    .status(HTTP_STATUS.OK)
    .json({ message: "Login Successful", currentLocation });
});

const refreshHandler = catchErrors(async (req, res) => {
  // validate request
  const refreshToken = req.cookies.refreshToken;
  appAssert(refreshToken, HTTP_STATUS.UNAUTHORIZED, "Missing refresh token");

  //call a service
  const { accessToken } = await refreshUserAccessToken(
    refreshToken
  );

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
    .json({ message: "Access token refreshed" });
});

const logoutHandler = catchErrors(async (req, res) => {
  const accessToken = req.cookies.accessToken;

  const { payload } = verifyToken(accessToken);

  //remove current session from db
  if (payload) {
    await SessionModel.findByIdAndDelete(payload.sessionId);
  }

  return clearAuthCookies(res).status(HTTP_STATUS.OK).json({
    message: "Logout successful",
  });
});


module.exports = {
    loginHandler,
    logoutHandler,
    refreshHandler,
  };
  