exports.STOCK_ADJUSTMENT_TYPES = ["increase", "decrease"];
exports.NOTIFICATION_TYPES = ["INFO", "SUCCESS", "WARNING", "DANGER"];
exports.PAYMENT_TYPES = ["PAID", "RECEIVED"];
exports.TRANSACTION_TYPES = ["purchase", "sale"];
exports.APPROVAL_STATUS = ["PENDING", "APPROVED", "REJECTED"];
exports.CRUD_TYPES = ["CREATE", "READ", "UPDATE", "DELETE"];
exports.LOCATION_TYPES = ["warehouse","branch"];
exports.CONTACT_TYPES = ["supplier", "customer"];
exports.SETTING_ID = "CLZ_SETTING";
exports.PURCHASE_PREFIX = "TRXPU-";
exports.SALE_PREFIX = "TRXSA-";
exports.TRANSFER_PREFIX = "TSFR-";
exports.ADJUSTMENT_INC_PREFIX = "ADJ-INC-";
exports.ADJUSTMENT_DEC_PREFIX = "ADJ-DEC-";
exports.INVENTORY_METHODS=["FIFO", "LIFO", "FEFO"] //fefo, if same expiry date, we use fifo then
exports.TELEGRAM_NOTIFICATION_TYPES = [
  "ALL",
  "LOW_STOCK_ALERT",
  "DAILY_REPORT",
];
exports.MAX_IMG_SIZE =  2 * 1024 * 1024 // 2MB file size limit
