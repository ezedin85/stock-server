
const mongoose = require("mongoose");
const { CRUD_TYPES } = require("../constants/constants");

const PermissionSchema = mongoose.Schema({
    group: {
        type: String,
        required: [true, "Permission group is required"],
    },
    crud_type: {
        type: String,
        required: [true, "Crud Type is required"],
        enum: CRUD_TYPES
    },
    code_name: {
        type: String,
        unique: true,
        required: [true, "Code Name is required"],
    },
    description: {
        type: String,
        unique: true,
        required: [true, "description is required"],
    },
}, { timestamps: true });

module.exports = mongoose.model("Permission", PermissionSchema);
