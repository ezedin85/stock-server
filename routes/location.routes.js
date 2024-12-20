const express = require("express");
const {
  getLocations,
  getLocation,
  addRecord,
  updateRecord,
  deleteRecord,
  getLocationNames,
} = require("../controllers/location.controller");
const {
  checkPermission,
  dynamicPermissionCheck,
} = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: dynamicPermissionCheck("location_type", {
    warehouse: "can_view_warehouse",
    branch: "can_view_branch",
  }),
  viewNames: checkPermission([
    "can_create_user",
    "can_update_user",
    "can_create_transfers",
  ]),
  create: dynamicPermissionCheck("location_type", {
    warehouse: "can_create_warehouse",
    branch: "can_create_branch",
  }),
  update: dynamicPermissionCheck("location_type", {
    warehouse: "can_update_warehouse",
    branch: "can_update_branch",
  }),
  delete: dynamicPermissionCheck("location_type", {
    warehouse: "can_delete_warehouse",
    branch: "can_delete_branch",
  }),
};

const router = express.Router();

// names for dropdown
router
  .get("/name-list", permissions.viewNames, getLocationNames)

  //list of locations by type
  .get("/:location_type", permissions.view, getLocations)

  // single record
  .get("/:location_type/:id", permissions.view, getLocation)

  // create record
  .post("/:location_type/create", permissions.create, addRecord)

  // update record
  .post("/:location_type/update/:id", permissions.update, updateRecord)

  // delete record
  .delete("/:location_type/delete/:id", permissions.delete, deleteRecord);

module.exports = router;
