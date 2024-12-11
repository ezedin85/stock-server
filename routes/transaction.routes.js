const express = require("express");
const {
  addRecord,
  getRecords,
  getRecord,
  updateGeneralTrxInfo,
  deleteTrxProduct,
  updatePurchase,
  updateSale,
  addPurchaseItem,
  addSaleItem,
} = require("../controllers/transaction.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");

const router = express.Router();

router.get("/:transaction_type", getRecords);

//Create Transaction
router.post("/:transaction_type/create", addRecord);

//get trx detail and transaction products under trx
router.get("/detail/:id", getRecord);

//update General trx info [contact, note..]
router.post("/update-general-info/:id", updateGeneralTrxInfo);

//add additional purchase item
router.patch("/add-product/purchase/:trx_id", addPurchaseItem);

//add additional sale item
router.patch("/add-product/sale/:trx_id", addSaleItem);

//update purchase item
router.patch("/update-product/purchase/:trx_item_id", updatePurchase);

// update sale item
router.patch("/update-product/sale/:trx_item_id", updateSale);

//delete trx item
router.delete("/delete-product/:trx_item_id", deleteTrxProduct);

module.exports = router;
