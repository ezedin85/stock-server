const path = require("path");
const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");
const cookieParser = require("cookie-parser");
const catchErrors = require("./utils/catchErrors");
require("dotenv").config();
const HTTP_STATUS = require("./constants/http");
const routes = require("./routes/index.routes.js");
const socketIO = require("socket.io");
const {
  onSocketConnected,
  socketAuthMiddleware,
} = require("./config/socket.js");


const app = express();

//convert row strings into js objects
app.use(express.json());

// Serve static files from the 'uploads' directory
//:TODO secure this folder (only logged in users at least)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//cors
app.use(
  cors({
    origin: process.env.APP_ORIGIN,
    credentials: true,
  })
);

//cookie parser
app.use(cookieParser());

//test
app.get(
  "/",
  catchErrors((req, res, next) => {
    return res.status(HTTP_STATUS.OK).json({
      status: "healthy",
    });
  })
);

//routes
app.use("/", routes);

//Error handler
app.use(errorHandler);

//start the server
const server = app.listen(process.env.PORT, async () => {
  console.log(
    `Server is running on port ${process.env.PORT} in ${process.env.NODE_ENV} mode`
  );
  await connectToDatabase();
});

// const io = socketIO(server, {
//   cors: {
//     origin: process.env.APP_ORIGIN,
//     methods: ["GET", "POST"],
//   },
// });

// io.use(socketAuthMiddleware);
// io.on("connection", onSocketConnected);

//SOCKT IO COMMENTS
//1. is it okay to send credenitals wiht socket?
//2. logout doesn't disconnect,
//3. so after logout can a user get messages
//4. double sockt id, may be bacause of react strict mode?  
//5. i continued with translation