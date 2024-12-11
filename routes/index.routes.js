const { Router } = require("express");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const sessionRoutes = require("./session.routes");
const roleRoutes = require("./role.routes");
const locationRoutes = require("./location.routes");
const contactRoutes = require("./contact.routes");
const productUnitRoutes = require("./productUnit.routes");
const productCategoryRoutes = require("./productCategory.routes");
const productRoutes = require("./product.routes");
const transactionRoutes = require("./transaction.routes");
const paymentRoutes = require("./payment.routes");

const authenticate = require("../middlewares/authenticate")

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", authenticate, userRoutes);
router.use("/sessions", authenticate, sessionRoutes);
router.use("/roles", authenticate, roleRoutes);
router.use("/locations", authenticate, locationRoutes);
router.use("/contacts", authenticate, contactRoutes);
router.use("/product-units", authenticate, productUnitRoutes);
router.use("/product-categories", authenticate, productCategoryRoutes);
router.use("/products", authenticate, productRoutes);
router.use("/transactions", authenticate, transactionRoutes);
router.use("/payments", authenticate, paymentRoutes);


module.exports = router;
