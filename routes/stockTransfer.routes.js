const express = require("express");
const {
  index,
  addRecord,
  getRecord,
  receiveProduct,
  returnProduct,
} = require("../controllers/stockTransfer.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");

const router = express.Router();

router.get("/", index);

router.post("/create", addRecord);

router.get("/detail/:id", getRecord);

router.post("/receive/:transfer_product_id", receiveProduct);

router.post("/return/:transfer_product_id", returnProduct);

module.exports = router;
