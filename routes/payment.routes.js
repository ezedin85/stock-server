const express = require("express");
const {
    getTrxPayments,
    addPayment,
    updatePayment,
    removePayment
} = require("../controllers/payment.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");


const router = express.Router();

router.get('/trx/:trx_id', getTrxPayments);
router.post('/trx/add/:trx_id', addPayment);
router.patch('/trx/update/:trx_id/:payment_id', updatePayment);
router.delete('/trx/remove/:trx_id/:payment_id', removePayment);

module.exports = router;


