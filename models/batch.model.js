const mongoose = require("mongoose");

const batchSchema = mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        location: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
        total_quantity: {
            type: Number,
            required: true,
            min: 0.01
        },
        quantity_in_stock: {
            type: Number,
            required: true,
            min: 0
        },
        unit_purchase_cost: {
            type: Number,
            required: true,
            min: 0
        },
        // production_date: Date,
        expiry_date: Date,
    },
    {
        timestamps: true
    }
)

module.exports = mongoose.model('Batch', batchSchema)
