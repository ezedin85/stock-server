const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const ProductModel = require("../models/product.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const { STOCK_ADJUSTMENT_TYPES } = require("../constants/constants");
const StockAdjustmentModel = require("../models/stockAdjustment.model");
const adjHelper = require("../helper/adjustmentHelper");
const { checkStockAvailability } = require("../utils/common");

exports.index = catchErrors(async (req, res) => {
  // validate request
  const location = req.currentLocation;

  // call service
  const adjustments = await StockAdjustmentModel.find({ location })
    .populate({
      path: "created_by",
      select: "first_name last_name",
    })
    .sort("-createdAt");

  // return response
  return res.status(HTTP_STATUS.OK).json(adjustments);
});

exports.addRecord = catchErrors(async (req, res) => {
  // validate request
  const { adjustment_type } = req.params;
  const created_by = req.userId;
  const location = req.currentLocation;
  const { products, reason } = req.body;
  utils.validateRequiredFields({ reason });

  //assert adjustment type
  appAssert(
    STOCK_ADJUSTMENT_TYPES.includes(adjustment_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Adjustment type!"
  );

  adjHelper.validateAdjustmentProducts(products, adjustment_type);

  // call service
  if (adjustment_type === "increase") {
    await adjHelper.increaseProductStocks({
      location,
      reason,
      products,
      created_by,
    });
  } else if (adjustment_type === "decrease") {
    //check stock availability for decreasing
    const { can_proceed, stock_error } = await checkStockAvailability({
      location,
      items: products,
    });
    appAssert(can_proceed, HTTP_STATUS.BAD_REQUEST, stock_error);

    // get batches with have (unexpired) items in the stock
    await adjHelper.decreaseProductStocks({
      location,
      reason,
      products,
      created_by,
    });

    await handleLowStockNotification({ req, items: products });
  }
  // return response
  return res.status(HTTP_STATUS.OK).json({message: `Stock Adjustment created successfully`});
});

exports.updateGeneralAdjustmentInfo = catchErrors(async (req, res) => {
  // validate request
  // call service
  // return response
});

exports.updateStockAdjustment = catchErrors(async (req, res) => {
  // validate request
  // call service
  // return response
});
