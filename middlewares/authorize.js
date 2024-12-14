const AppErrorCode = require("../constants/appErrorCodes");
const HTTP_STATUS = require("../constants/http");
const RoleModel = require("../models/role.model");
const UserModel = require("../models/user.model");
const appAssert = require("../utils/appAssert");
const catchErrors = require("../utils/catchErrors");

const checkPermission = (requiredPermissions) =>
  catchErrors(async (req, res, next) => {
    appAssert(req.userId, HTTP_STATUS.BAD_REQUEST, "Not Authorized");

    //find the user
    const user = await UserModel.findOne({
      _id: req.userId,
      is_active: true,
      deleted: false,
    });

    //Assert active and non deleted user exists in db
    appAssert(
      user,
      HTTP_STATUS.UNAUTHORIZED,
      "Your session has ended. Please log in again.",
      AppErrorCode.ACCOUNT_INACTIVE_OR_NOT_FOUND
    );

    const role = await RoleModel.findOne({
      _id: user.role,
      deleted: false,
    }).populate("permissions");

    //get user's permissions
    const assignedPermissions = role?.permissions || [];

    // Ensure `requiredPermissions` is always an array
    if (!Array.isArray(requiredPermissions)) {
      requiredPermissions = [requiredPermissions];
    }

    // Check if user has at least one of the required permissions
    const hasPermission = assignedPermissions.find((assignedPermission) =>
      requiredPermissions.includes(assignedPermission.code_name)
    );

    // Assert that the user is a super admin or has the required permission
    appAssert(
      user.is_super_admin || hasPermission,
      HTTP_STATUS.UNAUTHORIZED,
      "Not Authorized"
    );

    return next();
  });

const dynamicPermissionCheck = (entity, permissionsMap) => (req, res, next) => {
  const { [entity]: type } = req.params; // Dynamically extract the parameter (e.g., transaction_type, contact_type)
  const requiredPermission = permissionsMap[type];

  if (!requiredPermission) {
    return res.status(400).send(`Invalid ${entity} type.`);
  }

  // Call the checkPermission middleware with the required permission
  return checkPermission(requiredPermission)(req, res, next);
};

module.exports = { checkPermission, dynamicPermissionCheck };
