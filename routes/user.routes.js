const { Router } = require("express");
const {
  getMe,
  createUser,
  updateUser,
  index,
  getUser,
  deleteUser,
} = require("../controllers/user.controller");
const { uploadProfilePhoto } = require("../middlewares/multer");
const { checkPermission } = require("../middlewares/authorize");

//PEMISSIONS
const permissions = {
  view: checkPermission("can_view_user"),
  viewOwnProfile: checkPermission("can_view_own_profile"),
  create: checkPermission("can_create_user"),
  update: checkPermission("can_update_user"),
  delete: checkPermission("can_delete_user"),
};

const router = Router();

router
  .get("/", permissions.view, index)

  .get("/me", permissions.viewOwnProfile, getMe)

  .get("/:id", permissions.view, getUser)

  .post("/create", uploadProfilePhoto, permissions.create, createUser)

  .post("/update/:id", uploadProfilePhoto, permissions.update, updateUser)

  .delete("/delete/:id", permissions.delete, deleteUser);

// router.get("/change-location/:location", changeLocation);

module.exports = router;
