const UserModel = require("../models/user.model");
const NotificationModel = require("../models/notification.model");

const sendNotification = async ({
  req,
  notifiable_user,
  title,
  message,
  type,
  redirect_to
}) => {

  //if notifiable_user doesn't exist, return
  if (!notifiable_user) return

  //create notification document
  const notification = await NotificationModel.create({
    created_by: req.user?._id,
    notifiable_user_id: notifiable_user._id,
    title,
    message,
    type,
    redirect_to,
  });


//   if (notifiable_user.socketId) {
//     // Emit the notification event to the target user's connected socket
//     var socketio = req.app.get("socketio");
//     socketio
//       .to(notifiable_user.socketId)
//       .emit("clz-notification", {
//         notificationId: notification._id,
//         title: notification.title,
//         message: notification.message,
//         type: notification.type,
//         redirect_to: notification.redirect_to,
//         createdAt: notification.createdAt,
//       });


//   } else {
//     console.log("Target user is not online:", notifiable_user._id);
//   }
};


module.exports = {sendNotification}
