const mongoose = require("mongoose");
const transferProductSchema = mongoose.Schema(
  {
    transfer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transfer",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    total_quantity: { type: Number, default: 0 }, //holds total quantity including returned
    returned_quantity: { type: Number, default: 0 },
    sending_batches: [
      //holds affected batches by sending (doesn't include returned)
      {
        batch: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Batch",
          required: true,
        },
        quantity: { type: Number, required: true, min: .01 },
        received_qty: { type: Number, required: true, default: 0 }, //to controll, how many items received 👇 from this sending batch
      },
    ],
    receiving_batches: [
      {
        batch: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Batch",
          required: true,
        },
        quantity: { type: Number, required: true, min: .01 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TransferProduct", transferProductSchema);
