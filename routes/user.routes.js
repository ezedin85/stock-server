const { Router } = require("express");
const { getUserHandler } = require("../controllers/user.controller");

// prefix: /user
const userRoutes = Router();

userRoutes.get("/", getUserHandler);

module.exports = userRoutes;
