const express = require("express");
const {
    getTrxPayments
} = require("../controllers/payment.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");


const router = express.Router();

router.get('/trx/:trx_id', getTrxPayments);

module.exports = router;


