const express = require("express");
const {
    getRoles,
    //  getUpdateForm,
    // createRole, deleteRole, updateRole, createRoleForm
} = require("../controllers/role.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");


const router = express.Router();

router.get('/', getRoles);
// router.get("/create",  createRoleForm);
// router.post("/create",  createRole);
// router.get("/update/:id", getUpdateForm);
// router.post("/update/:id", updateRole);
// router.get('/delete/:id', deleteRole);

module.exports = router;


