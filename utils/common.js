const SettingModel = require("../models/setting.model");
const ProductModel = require("../models/product.model");
const LocationModel = require("../models/location.model");
const UserModel = require("../models/user.model");
const RoleModel = require("../models/role.model");
const PermissionModel = require("../models/permission.model");
const appAssert = require("../utils/appAssert");
const HTTP_STATUS = require("../constants/http");
const { SETTING_ID, INVENTORY_METHODS } = require("../constants/constants");
const { sendNotification } = require("../utils/socket");
const BatchModel = require("../models/batch.model");
const mongoose = require("mongoose");
const axios = require("axios");
const AppError = require("./AppError");

// 🟩 Checks if the expiry date should be considered based on system settings
const isExpiryDateConsidered = async () => {
  // Retrieve expiry setting,
  let setting = await SettingModel.findOne({ setting_id: SETTING_ID });
  // Assert the setting exists
  appAssert(setting, HTTP_STATUS.NOT_FOUND, `Setting not found!`);

  // Return the is_expiry_date_considered flag
  return setting.is_expiry_date_considered;
};

//🟩 Returns Current Stock Balance of a product
const getStockBalance = async ({ product_id, location }) => {
  let expiry_date_query = {}; // Default to an empty object, no expiry date condition

  // Checks if the expiry date should be considered
  const is_expiry_date_considered = await isExpiryDateConsidered();

  if (is_expiry_date_considered) {
    const today = new Date(); // Current date
    expiry_date_query = {
      $or: [
        { expiry_date: { $gt: today } }, // Batches with future expiry dates
        { expiry_date: null }, // Batches without expiry dates
      ],
    };
  }

  const result = await BatchModel.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(product_id),
        location: new mongoose.Types.ObjectId(location),
        ...expiry_date_query,
      },
    },
    {
      $group: {
        _id: null, //all results in one group
        stock_balance: { $sum: "$quantity_in_stock" },
      },
    },
  ]);

  const total_in_stock = Math.max(0, Number(result?.[0]?.stock_balance) || 0);

  return total_in_stock;
};

//🟩 Function to check stock availability before processing a stock out
const checkStockAvailability = async ({ location, items }) => {
  //1. assert products are provided
  if (!items || items.length < 1) {
    return {
      can_proceed: false,
      stock_error: "No items provided to check stock availability.",
    };
  }

  //2. Iterate through each item
  for (const item of items) {
    const { product, quantity, restocked_quantity = 0 } = item;

    //2.1 Assert product exists
    const current_product = await ProductModel.findOne({
      _id: product,
      deleted: false,
    }).populate({ path: "unit", select: "code" });
    if (!current_product) {
      return {
        can_proceed: false,
        stock_error: `Product not found for ID ${product}.`,
      };
    }

    // Get the current stock balance for the product
    const current_balance = await getStockBalance({
      product_id: product,
      location,
    });

    // The restocked_quantity will be set to 0 when creating a new record.
    // If updating an existing record, it will hold the previously stock out amount.
    const stock_balance = current_balance + restocked_quantity;

    //Insufficient stock
    if (stock_balance < quantity) {
      return {
        can_proceed: false,
        stock_error: `Insufficient stock for ${current_product.name}. \nMaximum Allowed: ${stock_balance} ${current_product.unit?.code} \nRequested: ${quantity} ${current_product.unit?.code}`,
      };
    }
  }

  return { can_proceed: true, stock_error: null };
};

// Get Batch Sort Query
const getBatchSortQuery = async () => {
  //get the inventory method being used
  let settings = await SettingModel.findOne({ setting_id: SETTING_ID })

  //Assert setting exists
  appAssert(settings, HTTP_STATUS.BAD_REQUEST, "Settings not found!");

  // Define sorting rules for each inventory strategy
  const sortStrategies = {
    FIFO: { createdAt: 1 }, // First-In, First-Out
    LIFO: { createdAt: -1 }, // Last-In, First-Out
    FEFO: { expiry_date: 1, createdAt: 1 }, // First-Expired, First-Out
  };

  // Return the corresponding sort query
  return sortStrategies[settings.inventory_method];
};

//🟩  Returns Stock Available batches
const getStockAvailableBatches = async ({ location, product_id, session }) => {
  //1. Get the sorting query based on the inventory method to determine stock out order.
  const sort_query = await getBatchSortQuery();

  let expiry_date_query = {}; // Default to an empty object, no expiry date condition

  // Checks if the expiry date should be considered
  const is_expiry_date_considered = await isExpiryDateConsidered();

  if (is_expiry_date_considered) {
    const today = new Date();
    expiry_date_query = {
      $or: [
        { expiry_date: { $gt: today } }, // Batches with future expiry dates
        { expiry_date: null }, // Batches without expiry dates
      ],
    };
  }

  // Retrieve batches with available stock
  const batches_with_available_stock = await BatchModel.find({
    product: product_id,
    location,
    quantity_in_stock: { $gt: 0 },
    ...expiry_date_query, // Conditionally include expiry date query
  })
    .session(session)
    .sort(sort_query);

  return batches_with_available_stock;
};

// Function to handle low stock notification
const handleLowStockNotification = async ({ req, items }) => {
  try {
    for (const item of items) {
      const { product } = item;
      const location = req.currentLocation;

      // Get the current stock balance for the product
      const stock_balance = await getStockBalance({
        product_id: product,
        location,
      });

      const current_product = await ProductModel.findById(product).populate(
        "unit"
      );

      // if stock is below the low stock threshold
      if (current_product.low_quantity >= stock_balance) {
        //Find Users to send stock alert
        let settings = await SettingModel.findOne({ setting_id: SETTING_ID });
        const stock_alert_to = settings.stock_alert_to;
        const stock_alert_users = await UserModel.find({
          _id: { $in: stock_alert_to },
          "locations.location": location,
          deleted: false,
          is_active: true,
        });

        const location_data = await LocationModel.findById(location);

        // construct message
        let message = `${current_product.name} in ${location_data.location_type} ${location_data.name}  has reached a low inventory level. Only ${stock_balance} units left. Consider restocking to meet future demand.`;
        let telegramMessage = `<u><b><tg-emoji emoji-id="5368324170671202286"> ⚠️ </tg-emoji>LOW STOCK ALERT</b></u> \n\n<b>Product:</b> ${current_product.name}\n<b>${location_data.location_type}:</b> ${location_data.name}\n<b>Current Stock:</b> ${stock_balance} ${current_product.unit?.code}`;
        let tgChatIds = stock_alert_users.map((user) => user.tgChatId);

        //send telegram notification
        await sendTelegramMessage({
          message: telegramMessage,
          imageUrl: `uploads/product-images/${current_product.image}`,
          tgChatIds,
        });

        //send in app notification
        stock_alert_users.forEach((notifiable_user) => {
          sendNotification({
            req,
            notifiable_user: notifiable_user._id,
            title: "Low Stock Alert",
            message,
            type: stock_balance <= 0 ? "DANGER" : "WARNING",
            redirect_to: `/products/history/${current_product._id}`,
          });
        });
      }
    }
  } catch (error) {
    console.log(
      "an error while sending low stock notification: ",
      error.message
    );
  }
};

const sendTelegramMessage = async ({ message, imageUrl, tgChatIds }) => {
  if (imageUrl) {
    try {
      const fullPath = path.join(process.cwd(), imageUrl);
      await fs.promises.access(fullPath); //check if file exists, if it doesn't it throws error
      const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`;

      for (const tgChatId of tgChatIds) {
        //loop thorugh allowed users
        const form = new FormData();
        form.append("chat_id", tgChatId);
        form.append("parse_mode", "HTML");
        form.append("caption", message);
        form.append("photo", fs.createReadStream(fullPath));
        try {
          const response = await axios.post(url, form, {
            headers: form.getHeaders(),
          });
          console.log(response.data);
        } catch (error) {
          console.error("Error uploading image:", error);
        }
      }
      return;
    } catch (error) {
      console.log("Filed send to telegram", error.message);
      //if image doesn't exist send the text only :next lines
    }
  }

  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;

  for (const tgChatId of tgChatIds) {
    axios
      .post(url, {
        chat_id: tgChatId,
        text: message,
        parse_mode: "HTML",
      })
      .then((response) => {
        console.log("Message sent:", response.data);
      })
      .catch((error) => {
        console.error(
          "Error sending message:",
          error.response ? error.response.data : error.message
        );
      });
  }
};

const findAdminsWithPermission = async (permission_name) => {
  try {
    // Find the permission by name
    const permission = await PermissionModel.findOne({
      code_name: permission_name,
    });

    if (!permission) return [];

    // Find roles that have this permission
    const roles_with_permission = await Role.find({
      permissions: { $in: [permission._id] },
      deleted: false,
    });

    // Find admin users with these roles
    const admins_with_permission = await UserModel.find({
      role: { $in: roles_with_permission.map((role) => role._id) },
      deleted: false,
    });

    return admins_with_permission;
  } catch (error) {
    return [];
  }
};

const hasPermissions = async (req, requiredPermissions) => {
  const user = await UserModel.findById(req.userId);

  // Fetch the role and its permissions
  const role = await RoleModel.findOne({
    _id: user.role,
    deleted: false,
  }).populate("permissions");

  const assignedPermissions = role?.permissions || [];
  const assignedPermissionCodes = assignedPermissions.map(
    (item) => item.code_name
  );

  return Object.fromEntries(
    requiredPermissions.map((permission) => [
      permission,
      assignedPermissionCodes.includes(permission),
    ])
  );
};

module.exports = {
  isExpiryDateConsidered,
  checkStockAvailability,
  getStockAvailableBatches,
  handleLowStockNotification,
  hasPermissions,
};
