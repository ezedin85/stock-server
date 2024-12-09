
const mongoose = require("mongoose");
const { TRANSACTION_TYPES } = require("../constants/constants");
const transactionSchema = mongoose.Schema(
    {
        trx_id: {
            type: String,
            required: [true, 'Transaction Id is required'],
            unique: true,
        },
        contact: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contact",
            required: true,
        },
        location: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
        transaction_type: {
            type: String,
            enum: TRANSACTION_TYPES,
            required: [true, "Transaction type is required"],
        },
        note: String,
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



module.exports = mongoose.model("Transaction", transactionSchema);


