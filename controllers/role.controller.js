const HTTP_STATUS = require("../constants/http");
const RoleModel = require("../models/role.model");
const catchErrors = require("../utils/catchErrors");

exports.getRoles = catchErrors(async (req, res) => {
  // call service
  const roles = await RoleModel.find({ deleted: false })
    .populate({
      path: "created_by",
      select: "first_name last_name",
    })
    .select("role_name created_by createdAt");

  // return response
  return res.status(HTTP_STATUS.OK).json(roles);
});
