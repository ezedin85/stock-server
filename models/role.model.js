
const mongoose = require("mongoose");

const RoleSchema = mongoose.Schema(
  {
    role_name: {
      type: String,
      trim: true,
      required: [true, "Role Name is required"],
      unique: true,
    },
    permissions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Permission" }
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creater user is required"],
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    deleted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deleted: {type: Boolean, default: false},
  },
  { timestamps: true }
);
module.exports = mongoose.model("Role", RoleSchema);