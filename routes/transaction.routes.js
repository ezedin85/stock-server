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
const {
  checkPermission,
  dynamicPermissionCheck,
} = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: dynamicPermissionCheck("transaction_type", {
    purchase: "can_view_purchase",
    sale: "can_view_sale",
  }),
  create: dynamicPermissionCheck("transaction_type", {
    purchase: "can_create_purchase",
    sale: "can_create_sale",
  }),
  updatePurchase: checkPermission("can_update_purchase"),
  updateSale: checkPermission("can_update_sale"),
  update: dynamicPermissionCheck("transaction_type", {
    purchase: "can_update_purchase",
    sale: "can_update_sale",
  }),
  delete: dynamicPermissionCheck("transaction_type", {
    purchase: "can_delete_purchase",
    sale: "can_delete_sale",
  }),
};

const router = express.Router();

router
  .get("/:transaction_type", permissions.view, getRecords)

  //Create Transaction
  .post("/:transaction_type/create", permissions.create, addRecord)

  //get trx detail and transaction products under trx
  .get("/detail/:transaction_type/:id", permissions.view, getRecord)

  //update General trx info [contact, note..]
  .post("/update-general-info/:transaction_type/:id", permissions.update, updateGeneralTrxInfo)

  //add additional purchase item
  .patch(
    "/add-product/purchase/:trx_id",
    permissions.updatePurchase,
    addPurchaseItem
  )

  //add additional sale item
  .patch("/add-product/sale/:trx_id", permissions.updateSale, addSaleItem)

  //update purchase item
  .patch(
    "/update-product/purchase/:trx_item_id",
    permissions.updatePurchase,
    updatePurchase
  )

  // update sale item
  .patch(
    "/update-product/sale/:trx_item_id",
    permissions.updateSale,
    updateSale
  )

  //delete trx item
  .delete("/delete-product/:transaction_type/:trx_item_id", permissions.delete, deleteTrxProduct);

module.exports = router;
