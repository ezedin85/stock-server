const express = require("express");
const {
  getRecords,
  getRecord,
  addRecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/product.controller");
const { uploadProductImage } = require("../middlewares/multer");

// const { checkPermission } = require("../../middlewares/role_middleware");

const router = express.Router();

router.get("/", getRecords);
router.get("/:id", getRecord);
router.post("/create", uploadProductImage, addRecord);
router.post("/update/:id", uploadProductImage, updateRecord);
router.delete("/delete/:id", deleteRecord);

module.exports = router;
