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
        "Some products have a an estimated cost less than zero. Please update them.",
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
    !utils.hasDuplicates(selectedProducts),
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
  appAssert(
    settings,
    HTTP_STATUS.BAD_REQUEST,
    "Settings not found for asjudment ID generation."
  );

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
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid adjustment type: ${adjustment_type}`
      );
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
    //1. get unique adjst ID
    const adjst_id = await getAdjustmentId({
      adjustment_type: "increase",
      session,
    });

    //2. SAVE adjustment general info
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

    //3. SAVE adj product and its batch
    //3.1 loop thorugh to be adjusted products
    for (const product of products) {
      //3.2 define batch query
      let batchQuery = {
        location,
        product: product.product,
        total_quantity: product.quantity,
        quantity_in_stock: product.quantity,
        unit_purchase_cost: product.unit_price,
        expiry_date: utils.isValidDate(new Date(product.expiry_date))
          ? new Date(product.expiry_date)
          : null,
      };

      //3.3  if expiry date is not considered, don't save the 'expiry' value
      if (!(await common.isExpiryDateConsidered())) {
        delete batchQuery.expiry_date;
      }

      //3.4 Save the batch, so the stock amount incrases
      const batch = await BatchModel.create([batchQuery], { session });

      //3.5 save the adjustment product data
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
    throw new AppError(error.statusCode, error.message);
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
    //1 get uniquie id
    const adjst_id = await getAdjustmentId({
      adjustment_type: "decrease",
      session,
    });

    //2 save adjustment general info
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

    //3. SAVE adj product and its batch
    //3.1 loop thorugh products
    for (const product of products) {
      //3.2 Retrieve batches with available stock and unexpired items,
      const batches_with_available_stock =
        await common.getStockAvailableBatches({
          location,
          product_id: product.product,
          session,
        });

      let affected_batches = []; //tracks from which batches stock is deducted from
      let total_processed = 0; // Tracks the total quantity adjusted for a single product across multiple batches

      // Iterate through batches and deduct until the desired quantity is fulfilled.
      for (const batch of batches_with_available_stock) {
        // Stop processing if the required quantity has already been fulfilled
        if (total_processed >= product.quantity) {
          break;
        }

        // Determine the quantity to deduct from the batch (minimum of available stock in the batch or
        // remaining unprocessed quantity)
        let qty_to_process_on_this_batch = Math.min(
          batch.quantity_in_stock,
          product.quantity - total_processed
        );

        // Reduce stock quantity
        await BatchModel.findByIdAndUpdate(
          batch._id,
          {
            $inc: { quantity_in_stock: -qty_to_process_on_this_batch },
          },
          { session }
        );

        affected_batches.push({
          batch: batch._id,
          quantity: qty_to_process_on_this_batch,
        });

        // Update the cumulative total quantity adjusted
        total_processed += qty_to_process_on_this_batch;
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
    throw new AppError(error.statusCode, error.message);
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
    //1. validate
    //1.1 Find the stock adjustment by ID
    // Records validated at parent level; no extra assertions needed.
    const single_adjustment = await StockAdjustmentProductModel.findById(
      single_adjustment_id
    ).session(session);

    //find the first adjustment batch, for stock in, there is only one batch
    const the_only_batch = single_adjustment.batches?.[0];

    const batch = await BatchModel.findById(the_only_batch.batch).session(
      session
    );
    appAssert(batch, HTTP_STATUS.BAD_REQUEST, "Batch not found!");

    const already_sold_from_batch =
      batch.total_quantity - batch.quantity_in_stock;

    //1.2 prevent decresing more than what is already been sold
    appAssert(
      quantity >= already_sold_from_batch,
      HTTP_STATUS.BAD_REQUEST,
      `Quantity too low. ${already_sold_from_batch} items have already been sold from this batch!`
    );

    //2. call service
    //2.1 update the batch quantity in single adjustmentProduct
    the_only_batch.quantity = quantity;
    await single_adjustment.save({ session });

    //2.2 update batch
    let updateBatchQuery = {
      total_quantity: quantity,
      quantity_in_stock: quantity - already_sold_from_batch,
      unit_purchase_cost: unit_price,
      expiry_date: utils.isValidDate(new Date(expiry_date))
        ? new Date(expiry_date)
        : null,
    };

    //3.3  if expiry date is not considered, don't save the 'expiry' value
    if (!(await common.isExpiryDateConsidered())) {
      delete updateBatchQuery.expiry_date;
    }

    await BatchModel.findByIdAndUpdate(
      the_only_batch.batch,
      { $set: updateBatchQuery },
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
    throw new AppError(error.statusCode, error.message);
  } finally {
    session.endSession();
  }
};

async function applyReturn({ single_adjustment_id, return_amt, updated_by }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Records validated at parent level; no extra assertions needed.
    const single_adjustment = await StockAdjustmentProductModel.findById(
      single_adjustment_id
    ).session(session);

    let remaining_return = return_amt;

    // Loop through batches of this adjustment in reverse order [since returning]
    for (
      let i = single_adjustment.batches?.length - 1;
      i >= 0 && remaining_return > 0;
      i--
    ) {
      const adjBatch = single_adjustment.batches[i];

      //2. If the remaining return is greater than or equal to the batch quantity,
      // return the items to the batch and remove it from the adjustment as there is no longer a connection
      if (remaining_return >= adjBatch.quantity) {
        //2.1.1 return items to the batch
        await BatchModel.findByIdAndUpdate(
          adjBatch.batch,
          {
            $inc: { quantity_in_stock: adjBatch.quantity },
          },
          { session }
        );

        //2.1.2 Subtract the quantity of the current batch from the remaining return amount.
        remaining_return -= adjBatch.quantity;

        //2.1.3 Remove the batch as the items have been fully returned
        single_adjustment.batches.splice(i, 1);
      } else {
        //2.2 If only a portion of the items from the batch are being returned, update the batch with the returned quantity

        //2.2.1 Update batch quantity for partial deduction
        await BatchModel.findByIdAndUpdate(
          adjBatch.batch,
          {
            $inc: { quantity_in_stock: remaining_return }, // return to the stock
          },
          { session }
        );

        // deduct stock adjustment quantity
        adjBatch.quantity -= remaining_return; //update the stock managment quantity

        remaining_return = 0; // Mark return as complete
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
    throw new AppError(error.statusCode, error.message);
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
    // Records validated at parent level; no extra assertions needed.
    const single_adjustment = await StockAdjustmentProductModel.findById(
      single_adjustment_id
    ).session(session);

    let affected_batches = [];

    // Retrieve batches with available stock
    const batches_with_available_stock = await common.getStockAvailableBatches({
      location,
      product_id: single_adjustment.product,
      session,
    });

    let total_processed = 0; // Tracks the total quantity decreased across multiple batches
    for (const batch of batches_with_available_stock) {
      // Exit if the required quantity has already been fulfilled
      if (total_processed >= additional_deduct_amount) break;

      // Determine the quantity to deduct from the batch (minimum of available stock in the batch or
      // remaining unprocessed quantity)
      let qty_to_decrease_from_this_batch = Math.min(
        batch.quantity_in_stock,
        additional_deduct_amount - total_processed
      );

      // Reduce stock quantity
      await BatchModel.findByIdAndUpdate(
        batch._id,
        {
          $inc: { quantity_in_stock: -qty_to_decrease_from_this_batch },
        },
        { session }
      );

      //data for adding in stock adjustment
      affected_batches.push({
        batch: batch._id,
        quantity: qty_to_decrease_from_this_batch,
      });

      // Update the cumulative total quantity 
      total_processed += qty_to_decrease_from_this_batch;
    }

    //save adjustment product
    single_adjustment.batches.push(...affected_batches);
    await single_adjustment.save({ session });


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
    throw new AppError(error.statusCode, error.message);
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
  applyNewStockOut,
};
