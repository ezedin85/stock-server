const mongoose = require("mongoose");
const { INVENTORY_METHODS } = require("../constants/constants");

const SettingSchema = mongoose.Schema(
  {
    setting_id: {
      type: String,
      required: true,
      unique: true,
    },
    trx_sequence: { type: Number, required: true, default: 0 },
    transfer_sequence: { type: Number, required: true, default: 0 },
    adjustment_sequence: { type: Number, required: true, default: 0 },
    daily_report_time: { type: String, required: true, default: "14:00" }, // Time in "HH:MM" format
    is_expiry_date_considered: {
      type: Boolean,
      required: true,
      default: false,
    }, // mind expiry dates or not
    inventory_method: {
      type: String,
      enum: INVENTORY_METHODS,
      required: true,
      default: INVENTORY_METHODS[0],
    },
    stock_alert_to: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    daily_report_to: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", SettingSchema);
