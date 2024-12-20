const SessionModel = require("../models/session.model");
const catchErrors = require("../utils/catchErrors");
const appAssert = require("../utils/appAssert");
const HTTP_STATUS = require("../constants/http");
const mongoose = require("mongoose");

const getSessionsHandler = catchErrors(async (req, res) => {
  const sessions = await SessionModel.find(
    {
      userId: req.userId,
      expiresAt: { $gt: Date.now() },
    },
    {
      _id: 1,
      // userAgent: 1,
      createdAt: 1,
      device: 1,
      browser: 1,
      os: 1,
    },
    {
      sort: { createdAt: -1 },
    }
  );

  console.log(sessions);

  return res.status(HTTP_STATUS.OK).json(
    sessions.map((session) => ({
      ...session.toObject(),
      ...(session.id === req.sessionId && { isCurrent: true }),
    }))
  );
});

const deleteSessionHandler = catchErrors(async (req, res) => {
  // validate request
  const sessionId = req.params.id;
  appAssert(
    mongoose.Types.ObjectId.isValid(sessionId),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid Session ID!"
  );

  appAssert(
    req.sessionId != sessionId,
    HTTP_STATUS.BAD_REQUEST,
    "Ending your current session is not allowed. Please log out if you wish to close your session. "
  );

  //call a service
  const deleted = await SessionModel.findOneAndDelete({
    _id: sessionId,
    userId: req.userId,
  });
  appAssert(deleted, HTTP_STATUS.NOT_FOUND, "Session not found");

  // return response
  return res.status(HTTP_STATUS.OK).json({ message: "Session removed" });
});

module.exports = { getSessionsHandler, deleteSessionHandler };
