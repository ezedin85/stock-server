const express = require("express");
const {
  getRecords,
  getProductNameList,
  getRecord,
  addRecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/product.controller");
const { uploadProductImage } = require("../middlewares/multer");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_products"),
  viewNames: checkPermission([
    "can_create_sale",
    "can_update_sale",
    "can_create_purchase",
    "can_update_purchase",
    "can_create_transfers",
    "can_create_stock_adjustment",
  ]),
  create: checkPermission("can_create_products"),
  update: checkPermission("can_update_products"),
  delete: checkPermission("can_delete_products"),
};

const router = express.Router();

//get list
router.get("/", permissions.view, getRecords);

// names for dropdown
router.get("/name-list", permissions.viewNames, getProductNameList);

//get one record
router.get("/:id", permissions.view, getRecord);

//create
router.post("/create", permissions.create, uploadProductImage, addRecord);

//update
router.post(
  "/update/:id",
  permissions.update,
  uploadProductImage,
  updateRecord
);

//delete
router.delete("/delete/:id", permissions.delete, deleteRecord);

module.exports = router;
