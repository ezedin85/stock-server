const express = require("express");
const {
  getRoles,
  getRole,
  getPermissions,
  createRole,
  updateRole,
  deleteRole
} = require("../controllers/role.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");

const router = express.Router();

router.get("/", getRoles);
router.get("/detail/:id", getRole);
router.post("/create", createRole);
router.get("/permissions", getPermissions);
router.post("/update/:id", updateRole);
router.delete('/delete/:id', deleteRole);

module.exports = router;
