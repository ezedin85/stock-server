const express = require("express");
const {
  getContacts,
  getNames,
  getContact,
  addRecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/contact.controller");
const { dynamicPermissionCheck } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: dynamicPermissionCheck("contact_type", {
    customer: "can_view_customer",
    supplier: "can_view_supplier",
  }),
  viewNames: dynamicPermissionCheck("contact_type", {
    customer: ["can_create_sale", "can_update_sale"],
    supplier: ["can_create_purchase", "can_update_purchase"],
  }),
  create: dynamicPermissionCheck("contact_type", {
    customer: "can_create_customer",
    supplier: "can_create_supplier",
  }),
  update: dynamicPermissionCheck("contact_type", {
    customer: "can_update_customer",
    supplier: "can_update_supplier",
  }),
  delete: dynamicPermissionCheck("contact_type", {
    customer: "can_delete_customer",
    supplier: "can_delete_supplier",
  }),
};

const router = express.Router();

router

  .get("/:contact_type", permissions.view, getContacts)

  .get("/:contact_type/name-list", permissions.viewNames, getNames)

  .get("/:contact_type/:id", permissions.view, getContact)

  .post("/:contact_type/create", permissions.create, addRecord)

  .post("/:contact_type/update/:id", permissions.update, updateRecord)

  .delete("/:contact_type/delete/:id", permissions.delete, deleteRecord);

module.exports = router;
