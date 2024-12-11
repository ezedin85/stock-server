const mongoose = require("mongoose");
const { STOCK_ADJUSTMENT_TYPES } = require("../constants/constants");

const stockAdjustmentShecma = mongoose.Schema(
  {
    adjst_id: {
      type: String,
      required: [true, "Adjustment Id is required"],
      unique: true,
    },
    adjustment_type: {
      type: String,
      enum: STOCK_ADJUSTMENT_TYPES,
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    reason: { type: String, required: true },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("StockAdjustment", stockAdjustmentShecma);
