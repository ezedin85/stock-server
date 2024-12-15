const express = require("express");
const {
  getTrxPayments,
  addPayment,
  updatePayment,
  deletePayment,
} = require("../controllers/payment.controller");
const {
  checkPermission,
  dynamicPermissionCheck,
} = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: dynamicPermissionCheck("transaction_type", {
    purchase: "can_view_purchase_payments",
    sale: "can_view_sale_payments",
  }),
  create: dynamicPermissionCheck("transaction_type", {
    purchase: "can_add_purchase_payments",
    sale: "can_add_sale_payments",
  }),
  update: dynamicPermissionCheck("transaction_type", {
    purchase: "can_update_purchase_payments",
    sale: "can_update_sale_payments",
  }),
  delete: dynamicPermissionCheck("transaction_type", {
    purchase: "can_delete_purchase_payments",
    sale: "can_delete_sale_payments",
  }),
};

const router = express.Router();

router.get("/:transaction_type/:trx_id", permissions.view, getTrxPayments);
router.post("/:transaction_type/add/:trx_id", permissions.create, addPayment);
router.patch(
  "/:transaction_type/update/:trx_id/:payment_id",
  permissions.update,
  updatePayment
);
router.delete(
  "/:transaction_type/delete/:trx_id/:payment_id",
  permissions.delete,
  deletePayment
);

module.exports = router;
