const mongoose = require("mongoose");
const { NOTIFICATION_TYPES } = require("../constants/constants");

const NotificationSchema = mongoose.Schema(
  {
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notifiable_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "The user to notify is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
    },
    message: {
      type: String,
      required: [true, "Message body is required"],
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
    },
    redirect_to: String,
    seen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification",NotificationSchema,);