const { Router } = require("express");
const {
  getSessionsHandler,
  deleteSessionHandler,
} = require("../controllers/session.controller");

const sessionRoutes = Router();
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_own_profile"),
  update: checkPermission("can_change_own_profile"),
};

sessionRoutes.get("/", permissions.view, getSessionsHandler);
sessionRoutes.delete("/:id", permissions.update, deleteSessionHandler);

module.exports = sessionRoutes;
