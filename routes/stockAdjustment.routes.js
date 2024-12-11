const { Router } = require("express");
const {
  index,
  addRecord,
  updateGeneralAdjustmentInfo,
  updateStockAdjustment,
} = require("../controllers/stockAdjustment.controller");

const router = Router();

router.get("/", index);

router.post("/:adjustment_type/create", addRecord);

router.patch(
  "/update/general-info/:adjustment_id",
  updateGeneralAdjustmentInfo
);

router.post("/update/:single_adjustment_id", updateStockAdjustment);

module.exports = router;
