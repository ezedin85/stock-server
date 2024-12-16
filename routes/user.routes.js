const { Router } = require("express");
const {
  getMe,
  createUser,
  updateUser,
  index,
  getUser,
  deleteUser,
  updateOwnProfile,
  changeLocation,
  changeOwnPassword,
  changeUserPassword
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
  changeLocation: checkPermission("can_view_own_profile"),
  updateOwnProfile: checkPermission("can_change_own_profile"),
  changeUserPassword: checkPermission("can_change_users_password"),
};

const router = Router();

router
  .get("/", permissions.view, index)

  .get("/me", permissions.viewOwnProfile, getMe)

  .get("/:id", permissions.view, getUser)

  .post("/create", permissions.create, uploadProfilePhoto, createUser)

  .post("/update/:id", permissions.update, uploadProfilePhoto, updateUser)

  .delete("/delete/:id", permissions.delete, deleteUser)

  .post(
    "/update-profile",
    permissions.updateOwnProfile,
    uploadProfilePhoto,
    updateOwnProfile
  )

  .post(
    "/change-own-password",
    permissions.updateOwnProfile,
    changeOwnPassword
  )

  .post("/change-location", permissions.changeLocation, changeLocation)

  .post(
    "/change-password/:id",
    permissions.changeUserPassword,
    changeUserPassword
  );
  
module.exports = router;
