const express = require("express");
const {
    index,
    getLocations,
    getLocation,
    addRecord,
    updateRecord,
    deleteRecord
} = require("../controllers/location.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");


const router = express.Router();

router.get('/', index);
router.get('/:location_type', getLocations);
router.get("/:location_type/:id", getLocation);
router.post("/:location_type/create",  addRecord);
router.post('/:location_type/update/:id',  updateRecord);
router.delete('/:location_type/delete/:id',  deleteRecord);

module.exports = router;


