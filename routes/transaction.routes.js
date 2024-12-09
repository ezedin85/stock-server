const express = require("express");
const {
    addRecord,

} = require("../controllers/transaction.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");

const router = express.Router();

//Create Transaction
router.post(
  "/:transaction_type/create",
  addRecord
);


module.exports = router;


