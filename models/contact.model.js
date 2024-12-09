const mongoose = require("mongoose");
const { CONTACT_TYPES } = require("../constants/constants");

const contactSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      // unique: true, //will be checked in controller based on contact type
    },
    mobile_number: {
      type: String,
      // required: true,
    },
    contact_type: {
      type: String,
      enum: CONTACT_TYPES,
      required: true,
    },
    address: String,
    email: String,
    company_name: String,
    company_email: String,
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

module.exports = mongoose.model("Contact", contactSchema);
