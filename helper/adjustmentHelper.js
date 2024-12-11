const utils = require("../utils/utils");
const common = require("../utils/common");
const {
  SETTING_ID,
  ADJUSTMENT_INC_PREFIX,
  ADJUSTMENT_DEC_PREFIX,
} = require("../constants/constants");
const HTTP_STATUS = require("../constants/http");
const SettingModel = require("../models/setting.model");
const StockAdjustmentModel = require("../models/stockAdjustment.model");
const BatchModel = require("../models/batch.model");
const StockAdjustmentProductModel = require("../models/stockAdjustmentProduct.model");
const appAssert = require("../utils/appAssert");
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const validateAdjustmentProducts = (products, adjustment_type) => {
  //loop thorugh products & remove products without product, quantity or unit_price
  products.forEach(({ product, quantity, unit_price }) => {
    const validations = [
      [product, "Please select a product for all entries."],
      [
        Number(quantity) > 0,
        "Some products have a quantity less than zero. Please update them.",
      ],
      [
        adjustment_type !== "increase" || Number(unit_price) > 0,
        "Some products have a unit less than zero. Please update them.",
      ],
    ];

    validations.forEach(([condition, errorMessage]) =>
      appAssert(condition, HTTP_STATUS.BAD_REQUEST, errorMessage)
    );
  });

  //ensure at least one product
  appAssert(
    products.length > 0,
    HTTP_STATUS.BAD_REQUEST,
    `You must select at least one valid product.`
  );

  //ensure no duplicate product
  let selectedProducts = products.map((item) => item.product);
  appAssert(
    !utils.hasDuplicates(selectedProducts) > 0,
    HTTP_STATUS.BAD_REQUEST,
    `A product cannot be adjusted more than once in a single adjustment.`
  );
};

/*
🟩 Returns Unique sequence based adjustment id */
const getAdjustmentId = async ({ adjustment_type, session }) => {
  const settings = await SettingModel.findOneAndUpdate(
    { setting_id: SETTING_ID },
    { $inc: { adjustment_sequence: 1 } },
    { new: true, session }
  );

  // Check if settings document exists
  if (!settings) {
    throw new Error("Settings not found for asjudment ID generation.");
  }

  let new_sequence = settings.adjustment_sequence;

  let adj_id;
  switch (adjustment_type) {
    case "increase":
      adj_id = ADJUSTMENT_INC_PREFIX + new_sequence;
      break;
    case "decrease":
      adj_id = ADJUSTMENT_DEC_PREFIX + new_sequence;
      break;
    default:
      throw new AppError(`Invalid adjustment type: ${adjustment_type}`);
  }

  return adj_id;
};

const increaseProductStocks = async ({
  location,
  reason,
  products,
  created_by,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //get unique adjst ID
    const adjst_id = await getAdjustmentId({
      adjustment_type: "increase",
      session,
    });

    //save adjustment general info
    const adjustment = await StockAdjustmentModel.create(
      [
        {
          adjst_id,
          adjustment_type: "increase",
          location,
          reason,
          created_by,
        },
      ],
      { session }
    );
    //get expiry date setting
    const is_expiry_date_considered = await common.isExpiryDateConsidered({
      session,
    });

    //loop thorugh to be adjusted products
    for (const product of products) {
      // Don't change the expiry date field, if is_expiry_date_considered is false
      const conditional_data = is_expiry_date_considered
        ? {
            expiry_date: utils.isValidDate(new Date(expiry_date))
              ? new Date(expiry_date)
              : null,
          }
        : {};

      // Save the batch, so the stock amount incrases
      const batch = await BatchModel.create(
        [
          {
            product: product.product,
            total_quantity: product.quantity,
            quantity_in_stock: product.quantity,
            unit_purchase_cost: product.unit_price,
            ...conditional_data,
            location,
          },
        ],
        { session }
      );

      //save the adjustment product data
      await StockAdjustmentProductModel.create(
        [
          {
            adjustment_id: adjustment?.[0]?._id,
            product: product.product,
            batches: [
              {
                batch: batch?.[0]?._id,
                quantity: product.quantity,
              },
            ],
          },
        ],
        { session }
      );
    }

    // Commit the transaction if everything went well
    await session.commitTransaction();
  } catch (error) {
    // If an error occurred, abort the transaction
    await session.abortTransaction();
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    // End the session
    session.endSession();
  }
};

//🟩 Decrease Stock helper */
const decreaseProductStocks = async ({
  location,
  reason,
  products,
  created_by,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adjst_id = await getAdjustmentId({
      adjustment_type: "decrease",
      session,
    });

    //save adjustment general info
    const adjustment = await StockAdjustmentModel.create(
      [
        {
          adjst_id,
          adjustment_type: "decrease",
          location,
          reason,
          created_by,
        },
      ],
      { session }
    );

    for (const product of products) {
      // Retrieve batches with available stock and unexpired items,
      const batches_with_available_stock =
        await common.getStockAvailableBatches({
          location,
          product_id: product.product,
        });

      let affected_batches = []; //tracks from which batches stock is deducted from
      let total_processed = 0; // Tracks the total quantity adjusted for a single product across multiple batches

      // Iterate through batches and deduct until the desired quantity is fulfilled.
      for (const batch of batches_with_available_stock) {
        // Stop processing if the required quantity has already been fulfilled
        if (total_processed >= product.quantity) {
          break;
        }

        // Determine the quantity to decrease from this batch as the smaller value between
        // the stock available in the batch and the remaining quantity needed to fulfill the order
        let qty_to_process_on_this_batch = Math.min(
          batch.quantity_in_stock,
          product.quantity - total_processed
        );

        affected_batches.push({
          batch: batch._id,
          quantity: qty_to_process_on_this_batch,
        });

        // Update the cumulative total quantity adjusted
        total_processed += qty_to_process_on_this_batch;

        // Deduct the quantity adjusted from the batch’s available stock in the inventory
        await BatchModel.findByIdAndUpdate(
          batch._id,
          {
            $inc: { quantity_in_stock: -qty_to_process_on_this_batch },
          },
          { session }
        );
      }

      await StockAdjustmentProductModel.create(
        [
          {
            adjustment_id: adjustment?.[0]?._id,
            batches: affected_batches,
            product: product.product,
          },
        ],
        { session }
      );
    }

    // Commit the transaction if everything went well
    await session.commitTransaction();
  } catch (error) {
    // If an error occurred, abort the transaction
    await session.abortTransaction();
    throw new AppError(HTTP_STATUS.BAD_REQUEST, error.message);
  } finally {
    // End the session
    session.endSession();
  }
};

const updateIncreaseAdjustment = async ({
  single_adjustment_id,
  unit_price,
  quantity,
  expiry_date,
  updated_by,
}) => {
  //creating session for data integrity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    //check required fields
    utils.validateRequiredFields({ unit_price });

    // Find the stock adjustment by ID within the session
    const single_adjustment = await StockAdjustmentProductModel.findById(
      single_adjustment_id
    ).session(session);

    appAssert(
      single_adjustment,
      HTTP_STATUS.BAD_REQUEST,
      "Selected adjustment Item not found!"
    );

    //check if the sold quanity from the batch is greater than the new stock quanity
    const the_only_batch = single_adjustment.batches?.[0]; //find the first adjustment batch, for stock in, there is only one batch

    const batch = await BatchModel.findById(the_only_batch.batch).session(
      session
    );
    appAssert(batch, HTTP_STATUS.BAD_REQUEST, "Batch not found!");

    const already_sold_from_batch =
      batch.total_quantity - batch.quantity_in_stock;

    if (already_sold_from_batch > quantity) {
      throw Error(
        `Quantity too low. ${already_sold_from_batch} items have already been sold from this batch!`
      );
    }

    //update the batch quantity in single adjustmentProduct
    the_only_batch.quantity = quantity;
    await single_adjustment.save({ session });

    //get expiry date setting
    const is_expiry_date_considered = await common.isExpiryDateConsidered({
      session,
    });

    // Don't change the expiry date field, if is_expiry_date_considered is false
    const conditional_data = is_expiry_date_considered
      ? {
          expiry_date: utils.isValidDate(new Date(expiry_date))
            ? new Date(expiry_date)
            : null,
        }
      : {};

    await BatchModel.findByIdAndUpdate(
      the_only_batch.batch,
      {
        $set: {
          total_quantity: quantity,
          quantity_in_stock: quantity - already_sold_from_batch,
          unit_purchase_cost: unit_price,
          ...conditional_data,
        },
      },
      { session }
    );

    //save updated by [general info]
    await StockAdjustmentModel.findByIdAndUpdate(
      single_adjustment.adjustment_id,
      { $set: { updated_by } },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw new AppError(error.message);
  } finally {
    session.endSession();
  }
};

async function applyReturn({ single_adjustment_id, return_amt, updated_by }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const single_adjustment = await StockAdjustmentProductModel.findById(
      single_adjustment_id
    ).session(session);

    appAssert(
      single_adjustment,
      HTTP_STATUS.BAD_REQUEST,
      "Selected adjustment Item not found!"
    );

    let remaining_return = return_amt;

    // Loop through batches of this adjustment in reverse order [since returning]
    for (
      let i = single_adjustment.batches?.length - 1;
      i >= 0 && remaining_return > 0;
      i--
    ) {
      const batch = single_adjustment.batches[i];

      if (remaining_return >= batch.quantity) {
        // Subtract the quantity of the current batch from the remaining return amount.
        remaining_return -= batch.quantity;

        // Update batch quantity here
        await BatchModel.findByIdAndUpdate(
          batch.batch,
          {
            $inc: { quantity_in_stock: batch.quantity },
          },
          { session }
        );

        // Remove this batch, the items taken are returned back to the batch
        single_adjustment.batches.splice(i, 1);
      } else {
        // deduct stock adjustment quantity
        batch.quantity -= remaining_return; //update the stock managment quantity

        // Update batch quantity for partial deduction
        await BatchModel.findByIdAndUpdate(
          batch.batch,
          {
            $inc: { quantity_in_stock: remaining_return }, // return to the stock
          },
          { session }
        );

        remaining_return = 0; // Deduction is done
      }
    }

    // Save the updated stock adjustment product
    await single_adjustment.save({ session });

    //save updated by [general info]
    await StockAdjustmentModel.findByIdAndUpdate(
      single_adjustment.adjustment_id,
      { $set: { updated_by } },
      { session }
    );

    await session.commitTransaction(); // Commit the transaction
    session.endSession(); // End the session

    return single_adjustment;
  } catch (error) {
    await session.abortTransaction(); // Rollback the transaction in case of error
    throw new AppError(error.message);
  } finally {
    session.endSession();
  }
}

const applyNewStockOut = async ({
  location,
  single_adjustment_id,
  additional_deduct_amount,
  updated_by,
}) => {
  const session = await mongoose.startSession(); // Start a session
  session.startTransaction(); // Begin the transaction

  try {
    // Find the stock adjustment by ID within the session
    const single_adjustment = await StockAdjustmentProductModel.findById(
      single_adjustment_id
    ).session(session);

    appAssert(
      single_adjustment,
      HTTP_STATUS.BAD_REQUEST,
      "Selected adjustment Item not found!"
    );

    let new_adjustment_data = [];

    // Retrieve batches with available stock and unexpired items, sorted by creation date (FIFO).
    const batches_with_available_stock = await common.getStockAvailableBatches({
      location,
      product_id: single_adjustment.product,
    });

    let total_decreased = 0; // Tracks the total quantity decreased across multiple batches
    for (const batch of batches_with_available_stock) {
      // Stop processing if the required quantity has already been fulfilled
      if (total_decreased >= additional_deduct_amount) {
        break;
      }

      // Determine the quantity to deduct from this batch as the smaller value between
      // the stock available in the batch and the remaining quantity needed to fulfill the order
      let qty_to_decrease_from_this_batch = Math.min(
        batch.quantity_in_stock,
        additional_deduct_amount - total_decreased
      );

      //data for adding in stock adjustment
      new_adjustment_data.push({
        batch: batch._id,
        quantity: qty_to_decrease_from_this_batch,
      });

      // Update the cumulative total quantity sold
      total_decreased += qty_to_decrease_from_this_batch;

      // Deduct the quantity sold from the batch’s available stock in the inventory
      await BatchModel.findByIdAndUpdate(
        batch._id,
        {
          $inc: { quantity_in_stock: -qty_to_decrease_from_this_batch },
        },
        { session }
      );
    }

    await StockAdjustmentProductModel.findByIdAndUpdate(
      single_adjustment_id,
      {
        $push: {
          batches: {
            $each: new_adjustment_data,
          },
        },
      },
      { session }
    );

    //save updated by [general info]
    await StockAdjustmentModel.findByIdAndUpdate(
      single_adjustment.adjustment_id,
      { $set: { updated_by } },
      { session }
    );

    // Commit the transaction if everything went well
    await session.commitTransaction();
  } catch (error) {
    // If an error occurred, abort the transaction
    await session.abortTransaction();
    throw Error(error.message);
  } finally {
    // End the session
    session.endSession();
  }
};

module.exports = {
  validateAdjustmentProducts,
  increaseProductStocks,
  decreaseProductStocks,
  updateIncreaseAdjustment,
  applyReturn,
  applyNewStockOut
};
