const mongoose = require("mongoose");
const { PAYMENT_TYPES } = require("../constants/constants");

const PaymentSchema = mongoose.Schema(
    {
        transaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
            required: true
        },
        amount: { type: Number, required: true, min: 0.01 }, // greater than 0
        remark: String,
        payment_type: {
            type: String,
            enum: PAYMENT_TYPES,
            required: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema,);