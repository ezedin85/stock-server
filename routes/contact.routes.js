const express = require("express");
const {
    // index,
    getContacts,
    getContact,
    addRecord,
    updateRecord,
    deleteRecord
} = require("../controllers/contact.controller");

// const { checkPermission } = require("../../middlewares/role_middleware");


const router = express.Router();

// router.get('/', index);
router.get('/:contact_type', getContacts);
router.get("/:contact_type/:id", getContact);
router.post("/:contact_type/create",  addRecord);
router.post('/:contact_type/update/:id',  updateRecord);
router.delete('/:contact_type/delete/:id',  deleteRecord);

module.exports = router;


