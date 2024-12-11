
const mongoose = require("mongoose");
const transferSchema = mongoose.Schema(
    {
        tsfr_id: {
            type: String,
            required: [true, 'Tsfr Id is required'],
            unique: true,
        },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
        receiver: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
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

module.exports = mongoose.model("Transfer", transferSchema);


