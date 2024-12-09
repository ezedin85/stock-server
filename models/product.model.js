const mongoose = require("mongoose");

const ProductSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    image: String,
    shelf: {
      type: String,
      // required: true,
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductUnit",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory",
      // required: true,
    },
    // subcategory: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "ProductSubcategory",
    //   // required: true,
    // },
    low_quantity: {
      type: Number,
      default: 2,
      min: 0,
    },
    buying_price: Number,
    selling_price: Number,
    does_expire: { type: Boolean, default: false },
    last_batch_number: { type: Number, default: 0 },
    description: String,
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deleted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", ProductSchema);
