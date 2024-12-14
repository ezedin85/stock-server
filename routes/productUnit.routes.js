const express = require("express");
const {
  getRecords,
  getUnitNames,
  getRecord,
  addRecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/productUnit.controller");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_product_unit"),
  viewNames: checkPermission(["can_create_products", "can_update_products"]),
  create: checkPermission("can_create_product_unit"),
  update: checkPermission("can_update_product_unit"),
  delete: checkPermission("can_delete_product_unit"),
};

const router = express.Router();

router
  //records permissions.,
  .get("/", permissions.view, getRecords)

  // names for dropdown
  .get("/name-list", permissions.viewNames, getUnitNames)

  //single record
  .get("/:id", permissions.view, getRecord)

  //create
  .post("/create", permissions.create, addRecord)

  //update
  .post("/update/:id", permissions.update, updateRecord)

  //delete
  .delete("/delete/:id", permissions.delete, deleteRecord);

module.exports = router;
