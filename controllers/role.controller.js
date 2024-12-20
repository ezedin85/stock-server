const HTTP_STATUS = require("../constants/http");
const RoleModel = require("../models/role.model");
const PermissionModel = require("../models/permission.model");
const catchErrors = require("../utils/catchErrors");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");

exports.getRoles = catchErrors(async (req, res) => {
  // call service
  const roles = await RoleModel.find({ deleted: false })
    .populate([{
      path: "created_by",
      select: "first_name last_name",
    },{
      path: "updated_by",
      select: "first_name last_name",
    }])
    .select("role_name created_by createdAt updatedAt updated_by permissions")
    .sort("-createdAt");

  // return response
  return res.status(HTTP_STATUS.OK).json(roles);
});


exports.getNames = catchErrors(async (req, res) => {
  // call service
  const roles = await RoleModel.find({ deleted: false })
    .select("role_name")

  // return response
  return res.status(HTTP_STATUS.OK).json(roles);
});


exports.getRole = catchErrors(async (req, res) => {
  // call service
  const { id } = req.params;
  const role = await RoleModel.findOne({ _id: id, deleted: false }).select(
    "role_name permissions"
  )

  appAssert(role, HTTP_STATUS.BAD_REQUEST, "Role not found!");

  // return response
  return res.status(HTTP_STATUS.OK).json(role);
});

exports.getPermissions = catchErrors(async (req, res) => {
  // call service
  const permissions = await PermissionModel.find().sort("group");

  // return response
  return res.status(HTTP_STATUS.OK).json(permissions);
});

exports.createRole = catchErrors(async (req, res) => {
  // validate request
  const { roleName, permissions } = req.body;

  //1.1 assert role name 
  utils.validateRequiredFields({ roleName });

  //1.2 asset no name conflict
  const nameConflict = await RoleModel.findOne({ role_name: roleName });
  appAssert(
    !nameConflict,
    HTTP_STATUS.BAD_REQUEST,
    "Role name already in use. Please use another name"
  );

  // call service
  await RoleModel.create({
    role_name: roleName,
    created_by: req.userId,
    permissions,
  });

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: "Successfully created new role" });
});

exports.updateRole = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  const { roleName, permissions } = req.body;
  const role = await RoleModel.findOne({ _id: id, deleted: false });
  appAssert(role, HTTP_STATUS.BAD_REQUEST, "Role not found!");

  role.role_name = roleName;
  role.permissions = permissions;
  role.updated_by = req.userId;
  await role.save();

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: "Role Updated successfully" });
});


exports.deleteRole = catchErrors(async(req, res) => {
  // validate request
  const { id } = req.params;
  const role = await RoleModel.findOne({ _id: id, deleted: false });
  appAssert(role, HTTP_STATUS.BAD_REQUEST, "Role not found!");

  // call service
  //2.1 mark role deleted
  const milliseconds_now = Date.now(); 
  role.role_name = `_${role.role_name}_${milliseconds_now}`;
  role.deleted = true;
  role.deleted_by = req.userId;
  await role.save();
  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Role deleted Successfully` });
});

