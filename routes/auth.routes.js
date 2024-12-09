const { Router } = require("express");
const {
  loginHandler,
  logoutHandler,
  refreshHandler,
} = require("../controllers/auth.controller");

const authRoutes = Router();

authRoutes.post("/login", loginHandler);
authRoutes.get("/logout", logoutHandler);
authRoutes.get("/refresh", refreshHandler);


module.exports = authRoutes;
