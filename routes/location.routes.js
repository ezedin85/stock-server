const express = require("express");
const {
  getLocations,
  getLocation,
  addRecord,
  updateRecord,
  deleteRecord,
  getLocationNames,
} = require("../controllers/location.controller");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_locations"),
  viewNames: checkPermission([
    "can_create_user",
    "can_update_user",
    "can_create_transfers",
  ]),
  create: checkPermission("can_create_locations"),
  update: checkPermission("can_update_locations"),
  delete: checkPermission("can_delete_locations"),
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
