const express = require("express");
const {
  getRoles,
  getNames,
  getRole,
  getPermissions,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/role.controller");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_roles"),
  viewNames: checkPermission(["can_create_user", "can_update_user"]),
  viewPermissions: checkPermission(["can_view_roles", "can_update_roles"]),
  create: checkPermission("can_create_roles"),
  update: checkPermission("can_update_roles"),
  delete: checkPermission("can_delete_roles"),
};

const router = express.Router();

router
  .get("/", permissions.view, getRoles)

  .get("/", permissions.viewNames, getNames)

  .get("/detail/:id", permissions.view, getRole)
  
  .post("/create", permissions.create, createRole)
  
  .get("/permissions", permissions.viewPermissions, getPermissions)
  
  .post("/update/:id", permissions.update, updateRole)
  
  .delete("/delete/:id", permissions.delete, deleteRole);

module.exports = router;
