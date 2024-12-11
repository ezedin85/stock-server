const { Router } = require("express");
const {
  index,
  getRecord,
  addRecord,
  updateGeneralAdjustmentInfo,
  updateStockAdjustment,
  deleteAdjustmentProduct
} = require("../controllers/stockAdjustment.controller");

const router = Router();

router.get("/", index);

//get adj detail and adjustment products under adj
router.get("/detail/:id", getRecord);


router.post("/:adjustment_type/create", addRecord);

router.patch(
  "/update/general-info/:id",
  updateGeneralAdjustmentInfo
);

router.patch("/update-product/:single_adjustment_id", updateStockAdjustment);


//delete adj item
router.delete("/delete-product/:single_adjustment_id", deleteAdjustmentProduct);

module.exports = router;
