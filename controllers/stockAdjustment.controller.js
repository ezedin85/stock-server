const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const ProductModel = require("../models/product.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const { STOCK_ADJUSTMENT_TYPES } = require("../constants/constants");
const StockAdjustmentModel = require("../models/stockAdjustment.model");
const StockAdjustmentProductModel = require("../models/stockAdjustmentProduct.model");
const BatchModel = require("../models/batch.model");

const adjHelper = require("../helper/adjustmentHelper");
const mongoose = require("mongoose");
const {
  checkStockAvailability,
  handleLowStockNotification,
} = require("../utils/common");
const AppError = require("../utils/AppError");

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

exports.getRecord = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  const location = req.currentLocation;

  const adjustment = await StockAdjustmentModel.findOne({
    _id: id,
    location,
  })
  .populate({
    path: "created_by",
    select: "first_name last_name",
  })
  .populate({
    path: "updated_by",
    select: "first_name last_name",
  });

  //assert adjustment exist and user is allowd with his current adj location
  appAssert(
    adjustment,
    HTTP_STATUS.BAD_REQUEST,
    "Selected adjustment not found at your current location."
  );

  const adjustment_products = await StockAdjustmentProductModel.find({
    adjustment_id: id,
  })
    .populate({
      path: "product",
      select: "name image",
      populate: {
        path: "unit",
        select: "code",
      },
    })
    .populate({
      path: "batches.batch",
      select: "expiry_date unit_purchase_cost",
    })
    
  // return response
  return res.status(HTTP_STATUS.OK).json({
    ...adjustment.toObject(),
    products: adjustment_products,
  });
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
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Stock Adjustment created successfully` });
});

exports.updateGeneralAdjustmentInfo = catchErrors(async (req, res) => {
  // validate request
  const { id } = req.params;
  const { reason } = req.body;
  const updated_by = req.userId;
  const location = req.currentLocation;

  //check required fields
  utils.validateRequiredFields({ reason });

  const adjustment = await StockAdjustmentModel.findOne({
    _id: id,
    location,
  });

  //assert adjustment exist and user is allowd with his current adj location
  appAssert(
    adjustment,
    HTTP_STATUS.BAD_REQUEST,
    "Selected adjustment not found at your current location."
  );

  // call service

  adjustment.reason = reason;
  adjustment.updated_by = updated_by;
  await adjustment.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Adjustment Updated Successfully` });
});

exports.updateStockAdjustment = catchErrors(async (req, res) => {
  // validate request
  const { single_adjustment_id } = req.params;

  const { expiry_date } = req.body;
  const quantity = Number(req.body?.quantity);
  const unit_price = Number(req.body?.unit_price);
  const updated_by = req.userId;
  const location = req.currentLocation;

  //check if the adjustment item exists
  const single_adjustment = await StockAdjustmentProductModel.findById(
    single_adjustment_id
  );

  //assert adjustment exist and user is allowd with his current adj location
  appAssert(
    single_adjustment,
    HTTP_STATUS.BAD_REQUEST,
    "Selected adjustment Item not found!"
  );

  const adjustment = await StockAdjustmentModel.findOne({
    _id: single_adjustment.adjustment_id,
    location,
  });

  //assert adjustment exist and user is allowd with his current adj location
  appAssert(
    adjustment,
    HTTP_STATUS.BAD_REQUEST,
    "Selected adjustment not found at your current location."
  );

  // call service
  if (adjustment.adjustment_type === "increase") {
    await adjHelper.updateIncreaseAdjustment({
      single_adjustment_id,
      unit_price,
      quantity,
      expiry_date,
      updated_by,
    });
  } else if (adjustment.adjustment_type === "decrease") {
    //previous quantity
    const prev_quantity = single_adjustment?.batches?.reduce(
      (acc, item) => acc + item.quantity,
      0
    );

    //check stock availability for stock out
    const { can_proceed, stock_error } = await checkStockAvailability({
      location,
      items: [
        {
          product: single_adjustment.product,
          quantity,
          restocked_quantity: prev_quantity,
        },
      ],
    });
    appAssert(can_proceed, HTTP_STATUS.BAD_REQUEST, stock_error);

    // If the new quantity is lower, add the difference back to the stock [return items]
    if (prev_quantity > quantity) {
      // how much is being returned
      const return_amt = prev_quantity - quantity;
      await adjHelper.applyReturn({
        single_adjustment_id,
        return_amt,
        updated_by,
      });
    } else if (quantity > prev_quantity) {
      // how much additional to deduct from stock
      const additional_deduct_amount = quantity - prev_quantity;
      await adjHelper.applyNewStockOut({
        location,
        single_adjustment_id,
        additional_deduct_amount,
        updated_by,
      });
    }
  }

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: "Stock Adjustment Updated Successfully" });
});

exports.deleteAdjustmentProduct = catchErrors(async (req, res) => {
  // validate request

  const { single_adjustment_id } = req.params;
  const updated_by = req.userId;
  const location = req.currentLocation;

  const single_adj = await StockAdjustmentProductModel.findById(
    single_adjustment_id
  );
  //assert selected contact exists & its correct contact type
  appAssert(
    single_adj,
    HTTP_STATUS.BAD_REQUEST,
    "Selected Adjustment Item not found"
  );

  const adjustment = await StockAdjustmentModel.findOne({
    _id: single_adj.adjustment_id,
    location,
  });
  appAssert(
    adjustment,
    HTTP_STATUS.BAD_REQUEST,
    "Selected adjustment not found at your current location."
  );

  // call service
  if (adjustment.adjustment_type === "increase") {
    const batch_id = single_adj.batches?.[0]?.batch; // find the purchase batch(there is only one batch for purchases)
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const batch = await BatchModel.findById(batch_id).session(session);

      appAssert(
        batch.quantity_in_stock === batch.total_quantity,
        HTTP_STATUS.BAD_REQUEST,
        `Deletion not allowed: ${
          batch.total_quantity - batch.quantity_in_stock
        } items from this adjustment have already been sold or transferred.`
      );

      //delete both the trx product and the associated batch
      await batch.deleteOne({ session });
      await single_adj.deleteOne({ session });

      adjustment.updated_by = updated_by;
      await adjustment.save({ session });

      //commit transaction
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
    } finally {
      session.endSession();
    }
  }else if (adjustment.adjustment_type === "decrease") {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const adj_batch of single_adj.batches) {
        // return items to the batch
        await BatchModel.findOneAndUpdate(
          { _id: adj_batch.batch, location },
          {
            $inc: { quantity_in_stock: adj_batch.quantity },
          },
          { session }
        );
      }

      await single_adj.deleteOne({ session });
      adjustment.updated_by = updated_by;
      await adjustment.save({ session });

      //commit transaction
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
    } finally {
      session.endSession();
    }
  }

  // return response
  return res.status(HTTP_STATUS.OK).json({ message: `Item successfully removed from the ${adjustment.adjustment_type} adjustment` });
});

