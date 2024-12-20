const express = require("express");
const {
  getSettings,
  updateSettings,
} = require("../controllers/settings.controller");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_company_settings"),
  update: checkPermission("can_update_company_settings"),
};

const router = express.Router();

//records
router

  //records
  .get("/", permissions.view, getSettings)

  //update
  .post("/update", permissions.update, updateSettings)

module.exports = router;
