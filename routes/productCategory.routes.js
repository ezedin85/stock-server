const express = require("express");
const {
    getRecords,
    getRecord,
    addRecord,
    updateRecord,
    deleteRecord
} = require("../controllers/productCategory.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");

const router = express.Router();

router.get('/', getRecords);
router.get("/:id", getRecord);
router.post("/create",  addRecord);
router.post('/update/:id',  updateRecord);
router.delete('/delete/:id',  deleteRecord);

module.exports = router;


