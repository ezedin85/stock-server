const express = require("express");
const {
  index,
  addRecord,
  getRecord,
  receiveProduct,
  returnProduct,
} = require("../controllers/stockTransfer.controller");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_transfers"),
  create: checkPermission("can_create_transfers"),
  update: checkPermission("can_update_transfers"),
};

const router = express.Router();

router
  .get("/", permissions.view, index)

  .post("/create", permissions.create, addRecord)

  .get("/detail/:id", permissions.view, getRecord)

  .patch("/receive/:transfer_product_id", permissions.update, receiveProduct)

  .patch("/return/:transfer_product_id", permissions.update, returnProduct);

module.exports = router;
