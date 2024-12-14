const express = require("express");
const {
  getRecords,
  getCategoryNames,
  getRecord,
  addRecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/productCategory.controller");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_product_category"),
  viewNames: checkPermission(["can_create_products", "can_update_products"]),
  create: checkPermission("can_create_product_category"),
  update: checkPermission("can_update_product_category"),
  delete: checkPermission("can_delete_product_category"),
};

const router = express.Router();

//records
router

  //records
  .get("/", permissions.view, getRecords)

  // names for dropdown
  .get("/name-list", permissions.viewNames, getCategoryNames)

  //single record
  .get("/:id", permissions.view, getRecord)

  //create
  .post("/create", permissions.create, addRecord)

  //update
  .post("/update/:id", permissions.update, updateRecord)

  //delete
  .delete("/delete/:id", permissions.delete, deleteRecord);

module.exports = router;
