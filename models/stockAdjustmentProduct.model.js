const mongoose = require("mongoose");
const stockAdjustmentProductSchema = mongoose.Schema(
  {
    adjustment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockAdjustment",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    batches: [
      {
        batch: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Batch",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          validate: {
            validator: (value) => value > 0,
            message: "Amount must be greater than 0.",
          },
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "StockAdjustmentProduct",
  stockAdjustmentProductSchema
);
