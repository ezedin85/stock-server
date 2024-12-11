const SettingModel = require("../models/setting.model");
const ProductModel = require("../models/product.model");
const LocationModel = require("../models/location.model");
const UserModel = require("../models/user.model");
const PermissionModel = require("../models/permission.model");
const appAssert = require("../utils/appAssert");
const HTTP_STATUS = require("../constants/http");
const { SETTING_ID, INVENTORY_METHODS } = require("../constants/constants");
const { sendNotification } = require("../utils/socket");
const BatchModel = require("../models/batch.model");
const mongoose = require("mongoose");
const axios = require("axios");

const isExpiryDateConsidered = async () => {
  //get expiry setting
  let setting = await SettingModel.findOne({ setting_id: SETTING_ID });

  //assert setting is found
  appAssert(setting, HTTP_STATUS.NOT_FOUND, `Setting not found!`);

  return setting.is_expiry_date_considered;
};

//🟩 Returns Current Stock Balance of a product
const getStockBalance = async ({ product_id, location }) => {
  const today = new Date(); // Current date

  let settings = await SettingModel.findOne({ setting_id: SETTING_ID });
  // if expiry date is considered, return un expired batches, if not, return all
  const is_expiry_date_considered = settings.is_expiry_date_considered;
  let expiry_date_query = {}; // Default to an empty object, no expiry date condition
  if (is_expiry_date_considered) {
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

  // If there are no matching documents, result will be an empty array
  const total_in_stock = result.length > 0 ? result[0].stock_balance : 0;

  return total_in_stock;
};

//🟩 Function to check stock availability before processing a stock out
const checkStockAvailability = async ({ location, items }) => {
  if (!items || items.length === 0) {
    return {
      can_proceed: false,
      stock_error: "No items provided to check stock availability.",
    };
  }

  // Iterate through each item
  for (const item of items) {
    const { product, quantity, restocked_quantity = 0 } = item;

    //check if product exist
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

    console.log(current_product);
    

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
        stock_error: `Insufficient stock for product ${current_product.name}. \nMaximum Allowed: ${stock_balance} ${current_product.unit?.code} \nRequested: ${quantity} ${current_product.unit?.code}`,
      };
    }
  }

  return { can_proceed: true, stock_error: null };
};

//🟩  Returns Stock Available batches
const getStockAvailableBatches = async ({ location, product_id }) => {
  const today = new Date();

  //get the inventory method being used
  let sort_query = {};
  let settings = await SettingModel.findOne({ setting_id: SETTING_ID });
  const inventory_method = settings.inventory_method;

  //Assert inventory method
  appAssert(
    INVENTORY_METHODS.includes(inventory_method),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid Inventory Method"
  );

  // Determine sorting method based on inventory strategy: FIFO, LIFO, or FEFO
  if (inventory_method === "FIFO") {
    // FIFO (First-In, First-Out): stock out from the oldest batches first
    sort_query = { createdAt: 1 };
  } else if (inventory_method === "LIFO") {
    // LIFO (Last-In, First-Out): stock out from the newest batches first
    sort_query = { createdAt: -1 };
  } else if (inventory_method === "FEFO") {
    // FEFO (First-Expired, First-Out): stock out from items nearest to expiry first
    // Within the same expiry date, older batcehs (by creation date) are prioritized
    sort_query = { expiry_date: 1, createdAt: 1 };
  }

  // if expiry date is considered, return un expired batches, if not, return all
  const is_expiry_date_considered = settings.is_expiry_date_considered;
  let expiry_date_query = {}; // Default to an empty object, no expiry date condition
  if (is_expiry_date_considered) {
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
  }).sort(sort_query);

  return batches_with_available_stock;
};

// Function to handle low stock notification
const handleLowStockNotification = async ({ req, items }) => {
  try {
    for (const item of items) {
      const { product } = item;
      const location = req.session.location;

      // Get the current stock balance for the product
      const stock_balance = await getStockBalance({
        product_id: product,
        location,
      });
      const current_product = await ProductModel.findById(product).populate(
        "unit"
      );
      const location_data = await LocationModel.findById(location);

      // Check if stock is below the low stock threshold
      if (current_product.low_quantity >= stock_balance) {
        const notifiable_users = await findAdminsWithPermission(
          "can_get_low_stock_notifications"
        );
        let message = `${current_product.name} in ${location_data.location_type} ${location_data.name}  has reached a low inventory level. Only ${stock_balance} units left. Consider restocking to meet future demand.`;
        let telegramMessage = `<u><b><tg-emoji emoji-id="5368324170671202286"> ⚠️ </tg-emoji>LOW STOCK ALERT</b></u> \n\n<b>Product:</b> ${current_product.name}\n<b>${location_data.location_type}:</b> ${location_data.name}\n<b>Current Stock:</b> ${stock_balance} ${current_product.unit?.code}`;

        //send telegram notification
        await sendTelegramMessage({
          message: telegramMessage,
          tg_notification_type: "LOW_STOCK_ALERT",
          imageUrl: `uploads/product-images/${current_product.image}`,
        });

        //send in app notification
        notifiable_users.forEach((notifiable_user) => {
          sendNotification({
            req,
            notifiable_user,
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

const sendTelegramMessage = async ({
  message,
  tg_notification_type,
  imageUrl,
}) => {
  let settings = await SettingModel.findOne({ setting_id: SETTING_ID });

  //check if telegram user have permsisin to see the notification
  const chat_ids = settings.telegram_notified_users
    ?.filter(({ notification_types }) =>
      notification_types?.some((type) =>
        ["ALL", tg_notification_type].includes(type)
      )
    )
    .map((user) => user.chat_id);

  if (imageUrl) {
    try {
      const fullPath = path.join(process.cwd(), imageUrl);
      await fs.promises.access(fullPath); //check if file exists, if it doesn't it throws error
      const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`;

      for (const chat_id of chat_ids) {
        //loop thorugh allowed users
        const form = new FormData();
        form.append("chat_id", chat_id);
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

  for (const chat_id of chat_ids) {
    axios
      .post(url, {
        chat_id: chat_id,
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

module.exports = {
  isExpiryDateConsidered,
  checkStockAvailability,
  checkStockAvailability,
  getStockAvailableBatches,
  handleLowStockNotification,
};
