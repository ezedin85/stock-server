const TransactionProductModel = require("../models/transactionProduct.model");
const mongoose = require("mongoose");

const getStartAndEndDate = (type) => {
  let startDate;
  let endDate;

  if (type === "d") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Midnight today
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // End of today

    startDate = startOfToday;
    endDate = endOfToday;
  } else if (type === "w") {
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of the week (Sunday)

    const endOfWeek = new Date();
    endOfWeek.setHours(23, 59, 59, 999);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay())); // End of the week (Saturday)

    startDate = startOfWeek;
    endDate = endOfWeek;
  } else if (type === "m") {
    const startOfMonth = new Date();
    startOfMonth.setDate(1); // First day of the month
    startOfMonth.setHours(0, 0, 0, 0); // Midnight

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(startOfMonth.getMonth() + 1); // First day of the next month
    endOfMonth.setHours(0, 0, 0, -1); // End of this month (last millisecond)

    startDate = startOfMonth;
    endDate = endOfMonth;
  } else if (type === "y") {
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1); // January 1st
    startOfYear.setHours(0, 0, 0, 0); // Midnight

    const endOfYear = new Date(startOfYear);
    endOfYear.setFullYear(startOfYear.getFullYear() + 1); // First day of next year
    endOfYear.setHours(0, 0, 0, -1); // End of this year (last millisecond)

    startDate = startOfYear;
    endDate = endOfYear;
  }

  return { startDate, endDate };
};

const transactionReport = async (req, res) => {
  try {
  const location = req.currentLocation;

    const { type } = req.query;
    if (!["d", "w", "m", "y"].includes(type)) {
      throw Error("Invalid Transaction limit type");
    }

    let report_type = "";
    if (type === "d") report_type = "Today's";
    else if (type === "w") report_type = "This Week's";
    else if (type === "m") report_type = "This Month's";
    else if (type === "y") report_type = "This Year's";

    //Today's report
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Midnight today
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // End of today

    const { startDate, endDate } = getStartAndEndDate(type);

    const { result: saleData, error: today_sale_error } =
      await getTransactionReport({
        transaction_type: "sale",
        location,
        startDate,
        endDate,
      });
    const { result: purchaseData, error: today_purchase_error } =
      await getTransactionReport({
        transaction_type: "purchase",
        location,
        startDate,
        endDate,
      });

    res.render("pages/report/transaction_report", {
      saleData,
      today_sale_error,
      purchaseData,
      today_purchase_error,
      title: `${report_type} Transaction Report`,
      report_type,
      type,
    });
  } catch (error) {
    console.log(error.message);
    req.flash("error", error.message);
    res.redirect("/");
  }
};

const getTransactionReport = async ({
  transaction_type,
  location,
  startDate,
  endDate,
}) => {
  try {
    const location_object_id = new mongoose.Types.ObjectId(location);

    const result = await TransactionProductModel.aggregate([
      {
        $lookup: {
          from: "transactions",
          localField: "transaction_id",
          foreignField: "_id",
          as: "transaction",
        },
      },
      { $unwind: "$transaction" },
      {
        $match: {
          "transaction.transaction_type": transaction_type,
          "transaction.location": location_object_id,
          "transaction.createdAt": {
            $gte: new Date(startDate),
            $lt: new Date(endDate),
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $group: {
          _id: "$product._id",
          product_name: { $first: "$product.name" },
          quantity: {
            $sum: {
              $reduce: {
                input: "$batches.quantity",
                initialValue: 0,
                in: { $add: ["$$value", "$$this"] },
              },
            },
          },
          total: {
            $sum: {
              $let: {
                vars: {
                  // Summing all quantities from the batches array
                  total_quantity: {
                    $reduce: {
                      input: "$batches.quantity", 
                      initialValue: 0,
                      in: { $add: ["$$value", "$$this"] }, 
                    },
                  },
                  // Retrieve the percentage or default to 0 if not provided
                  percentage: {
                    $ifNull: ["$vat_percentage", 0],
                  },
                },
                in: {
                  // Calculate the total with percentage adjustment if applicable
                  $cond: {
                    if: { $gt: ["$$percentage", 0] }, // Check if percentage > 0
                    then: {
                      $add: [
                        // Add the percentage adjustment to the base amount
                        { $multiply: ["$$total_quantity", "$unit_price"] }, // Base amount: quantity * unit price
                        {
                          $multiply: [
                            // Percentage adjustment
                            { $multiply: ["$$total_quantity", "$unit_price"] }, // Base amount
                            { $divide: ["$$percentage", 100] }, // Percentage as a decimal
                          ],
                        },
                      ],
                    },
                    else: {
                      $multiply: ["$$total_quantity", "$unit_price"], // No percentage adjustment
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    return { result };
  } catch (error) {
    return { error: error.message, result: [] };
  }
};

/**
 * match date and transaction type,
 * unwind products
 * group products by product id
 * add sum or multiply
 * return
 */

module.exports = {
  getTransactionReport,
  transactionReport,
};
