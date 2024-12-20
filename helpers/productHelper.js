const ProductModel = require("../models/product.model");
const mongoose = require("mongoose");
const { isExpiryDateConsidered } = require("../utils/common");

const getProductsList = async ({
  page,
  show,
  locations,
  filters,
  stock_filter,
  can_view_company_reports,
  can_create_purchase,
  can_create_sale,
}) => {
  const pageNumber = parseInt(page);
  const parsedLength = parseInt(show);
  const limit = isNaN(parsedLength) || parsedLength > 100 ? 10 : parsedLength; //prevent more than 0

  const today = new Date(); // Current date to check expiry date

  //check if expiry date is being considered
  const is_expiry_date_considered = await isExpiryDateConsidered();

  //returns an id for groupping
  const isExpiredCondition = is_expiry_date_considered
    ? {
        $cond: [
          //first argument of $cond is if statment
          {
            $or: [
              { $eq: ["$expiry_date", null] }, // No expiry date
              { $gt: ["$expiry_date", today] }, // Expiry date in the future
            ],
          },
          "nonExpired", // Value if condition is true (non-expired)
          "expired", // Value if condition is false (expired)
        ],
      }
    : "nonExpired"; // If expiry date is not considered, always return "nonExpired"

  const result = await ProductModel.aggregate([
    { $match: { ...filters, deleted: false } },
    {
      $lookup: {
        from: "batches",
        let: { product_id: "$_id" },
        pipeline: [
          // aggregation pipeline
          // pipeline applies additional filtering on Batch documents. (to match by product id then get stock value)
          {
            $match: {
              $expr: { $eq: ["$product", "$$product_id"] },
              location: { $in: locations },
            },
          },
          {
            //calculate stock value of each batch
            $addFields: {
              batch_value: {
                $multiply: ["$quantity_in_stock", "$unit_purchase_cost"],
              },
            },
          },
          {
            $group: {
              //group batches by expired and non expired
              _id: {
                isExpired: isExpiredCondition, // Conditional 'isExpired' based on settings,
              },
              quantity: { $sum: "$quantity_in_stock" },
              estimated_value: { $sum: "$batch_value" },
            },
            /*expected output: 
            [ { "_id": { "isExpired": "nonExpired" }, "quantity": 100, estimated_value: "4400" },
              { "_id": { "isExpired": "expired" }, "quantity": 50, estimated_value: "1400" }
            ]
            */
          },
          {
            // Grouping into one object in an array
            $group: {
              _id: null,
              expired_quantity: {
                $sum: {
                  $cond: [
                    { $eq: ["$_id.isExpired", "expired"] },
                    "$quantity",
                    0,
                  ],
                },
              },
              estimated_expired_value: {
                $sum: {
                  $cond: [
                    { $eq: ["$_id.isExpired", "expired"] },
                    "$estimated_value",
                    0,
                  ],
                },
              },
              stock_amount: {
                $sum: {
                  $cond: [
                    { $eq: ["$_id.isExpired", "nonExpired"] },
                    "$quantity",
                    0,
                  ],
                },
              },
              estimated_stock_value: {
                $sum: {
                  $cond: [
                    { $eq: ["$_id.isExpired", "nonExpired"] },
                    "$estimated_value",
                    0,
                  ],
                },
              },
            },
          },
          /* expected output
            [{
              "_id": null,
              "expired_quantity": 22, 
              "stock_amount": 10 
            }] */
        ],
        as: "batches",
      },
    },
    {
      $unwind: { path: "$batches", preserveNullAndEmptyArrays: true },
    },
    {
      $set: {
        expired_quantity: { $ifNull: ["$batches.expired_quantity", 0] },
        estimated_expired_value: {
          $ifNull: ["$batches.estimated_expired_value", 0],
        },
        stock_amount: { $ifNull: ["$batches.stock_amount", 0] },
        estimated_stock_value: {
          $ifNull: ["$batches.estimated_stock_value", 0],
        },
      },
    },
    {
      $match: {
        $expr: stock_filter,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "created_by",
        foreignField: "_id",
        as: "created_by",
      },
    },
    { $unwind: { path: "$created_by", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "updated_by",
        foreignField: "_id",
        as: "updated_by",
      },
    },
    { $unwind: { path: "$updated_by", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "productunits",
        localField: "unit",
        foreignField: "_id",
        as: "unit",
      },
    },
    { $unwind: { path: "$unit", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "productcategories",
        localField: "category",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $facet: {
        data: [
          {
            $project: {
              _id: 1,
              name: 1,
              expired_quantity: 1,
              estimated_expired_value: 1,
              stock_amount: 1,
              estimated_stock_value: {
                //show stock value if only user has "can_view_company_reports" permission
                $cond: [
                  { $eq: [can_view_company_reports, true] },
                  "$estimated_stock_value",
                  "$$REMOVE",
                ],
              },
              image: 1,
              buying_price: {
                //show buying_price if only user has "can_create_purchase" permission
                $cond: [
                  { $eq: [can_create_purchase, true] },
                  "$buying_price",
                  "$$REMOVE",
                ],
              },
              selling_price: {
                //show selling_price if only user has "can_create_sale" permission
                $cond: [
                  { $eq: [can_create_sale, true] },
                  "$selling_price",
                  "$$REMOVE",
                ],
              },
              low_quantity: 1,
              shelf: 1,
              sku: 1,
              createdAt: 1,
              updatedAt: 1,
              description: 1,
              created_by: { _id: 1, first_name: 1, last_name: 1 },
              updated_by: { _id: 1, first_name: 1, last_name: 1 },
              unit: { _id: 1, code: 1 },
              category: { _id: 1, name: 1 },
            },
          },
          { $sort: { name: 1 } },
          { $skip: (pageNumber - 1) * limit },
          { $limit: limit },
        ],
        // Second facet for the total count of records (before skip and limit)
        recordsFiltered: [
          {
            $count: "total", // Count the total number of documents matching the conditions
          },
        ],
      },
    },

    {
      $project: {
        data: 1,
        recordsFiltered: {
          $arrayElemAt: ["$recordsFiltered.total", 0], // Extract the count from the recordsFiltered facet
        },
      },
    },
  ]);

  return result[0];
};

module.exports = { getProductsList };
