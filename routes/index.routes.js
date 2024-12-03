const { Router } = require("express");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const sessionRoutes = require("./session.routes");
const authenticate = require("../middlewares/authenticate")

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", authenticate, userRoutes);
router.use("/sessions", authenticate, sessionRoutes);


module.exports = router;
