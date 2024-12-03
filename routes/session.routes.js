const { Router } = require("express");
const { getSessionsHandler, deleteSessionHandler } = require("../controllers/session.controller");

// prefix: /session
const sessionRoutes = Router();

sessionRoutes.get("/", getSessionsHandler);
sessionRoutes.delete("/:id", deleteSessionHandler);

module.exports = sessionRoutes;
