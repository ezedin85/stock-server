const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const UserModel = require("../models/user.model");

const socketAuthMiddleware = (socket, next) => {
  try {
    const cookies = socket.handshake.headers.cookie;

    if (!cookies) {
      return next(new Error("Authentication error: No cookies found"));
    }

    const parsedCookies = cookie.parse(cookies); // Parse the cookies
    const token = parsedCookies["accessToken"]; // Get the access token from cookies

    if (!token) {
      return next(new Error("Authentication error: No token in cookies"));
    }

    try {
      const user = jwt.verify(token, process.env.JWT_ACCESS_SECRET); // Verify the token
      socket.user = user; // Attach user info to the socket
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  } catch (error) {
    console.log("Socket Auth Error");
  }
};

const onSocketConnected = async (socket) => {
  try {
    const userId = socket?.user?.userId;
    if (userId) {
      await UserModel.updateOne(
        { _id: userId },
        { $addToSet: { socketIds: socket.id } } // $addToSet prevents duplicate socket IDs
      );
    }

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${userId}, Socket ID: ${socket.id}`);
      if (userId) {
        await UserModel.updateOne(
          { _id: userId },
          { $pull: { socketIds: socket.id } } // Remove socket ID from the user's record
        );
      }
    });
  } catch (err) {
    console.error("Error updating user socket ID:", err);
  }
};

// socket.broadcast.emit("notification", { mesage: "someone joind" });

module.exports = { onSocketConnected, socketAuthMiddleware };
