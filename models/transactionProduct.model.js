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
        quantity: { type: Number, required: true, min: .01 },
      },
    ],
    unit_price: { type: Number, required: true, min: 0.01 }, // greater than 0
    vat_percentage: Number, // greater than 0
  },
  { timestamps: true }
);

module.exports = mongoose.model("TransactionProduct", transactionProductSchema);
