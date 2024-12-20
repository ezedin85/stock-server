const mongoose = require("mongoose");
const { oneDayFromNow } = require("../utils/date");

const sessionSchema = new mongoose.Schema({
  userId: {
    ref: "User",
    type: mongoose.Schema.Types.ObjectId,
    index: true, // Improves performance when querying by `userId`
  },
  userAgent: { type: String },
  ip: String,
  device: String,
  browser: String,
  os: String,
  location: { 
    city: String,
    region: String,
    country: String
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: oneDayFromNow,
  },
});

const SessionModel = mongoose.model("Session", sessionSchema);

module.exports = SessionModel;
