const { Router } = require("express");
const {
  index,
  getRecord,
  addRecord,
  updateGeneralAdjustmentInfo,
  updateStockAdjustment,
  deleteAdjustmentProduct,
} = require("../controllers/stockAdjustment.controller");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_stock_adjustment"),
  create: checkPermission("can_create_stock_adjustment"),
  update: checkPermission("can_update_stock_adjustment"),
  delete: checkPermission("can_delete_stock_adjustment"),
};

const router = Router();

router
  .get("/", permissions.view, index)

  //get adj detail and adjustment products under adj
  .get("/detail/:id", permissions.view, getRecord)

  .post("/:adjustment_type/create", permissions.create, addRecord)

  .patch(
    "/update/general-info/:id",
    permissions.update,
    updateGeneralAdjustmentInfo
  )

  .patch(
    "/update-product/:single_adjustment_id",
    permissions.update,
    updateStockAdjustment
  )

  //delete adj item
  .delete(
    "/delete-product/:single_adjustment_id",
    permissions.delete,
    deleteAdjustmentProduct
  );

module.exports = router;
