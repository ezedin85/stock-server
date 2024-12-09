const { Router } = require("express");
const {
  getMe,
  createUser,
  updateUser,
  index,
  getUser,
  deleteUser
} = require("../controllers/user.controller");
const { uploadProfilePhoto } = require("../middlewares/multer");

// prefix: /user
const router = Router();

router.get("/", index);
router.get("/me", getMe);
router.get("/:id", getUser);
router.post("/create", uploadProfilePhoto, createUser);
router.post("/update/:id", uploadProfilePhoto, updateUser);
router.delete("/delete/:id", deleteUser);

// router.get("/change-location/:location", changeLocation);

module.exports = router;
