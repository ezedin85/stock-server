const mongoose = require("mongoose");
const transactionProductSchema = mongoose.Schema(
  {
    transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
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
            message: "Quantity must be greater than 0.",
          },
        },
      },
    ],
    unit_price: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => value > 0,
        message: "Amount must be greater than 0.",
      },
    },
    vat_percentage: Number, // on sell only
  },
  { timestamps: true }
);

module.exports = mongoose.model("TransactionProduct", transactionProductSchema);
