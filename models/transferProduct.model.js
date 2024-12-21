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
    total_quantity: {
      //holds total quantity including returned
      type: Number,
      validate: {
        validator: (value) => value > 0,
        message: "Total Quantity must be greater than 0.",
      },
    },
    returned_quantity: {
      type: Number,
      default: 0,
      validate: {
        validator: (value) => value >= 0,
        message: "Returned Quantity must be equal or greater than 0.",
      },
    },
    sending_batches: [
      //holds affected batches by sending (doesn't include returned)
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
        received_qty: {
          type: Number,
          required: true,
          default: 0,
          validate: {
            validator: (value) => value >= 0,
            message: "Received Quantity must be equal or greater than 0.",
          },
        }, //to controll, how many items received 👇 from this sending batch
      },
    ],
    receiving_batches: [
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("TransferProduct", transferProductSchema);
