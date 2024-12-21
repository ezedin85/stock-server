const mongoose = require("mongoose");

const batchSchema = mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    total_quantity: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => value > 0,
        message: "Amount must be greater than 0.",
      },
    },
    quantity_in_stock: {
      type: Number,
      required: true,
      min: 0,
    },
    unit_purchase_cost: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => value > 0,
        message: "Amount must be greater than 0.",
      },
    },
    expiry_date: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Batch", batchSchema);
