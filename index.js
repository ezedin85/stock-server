const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");
const cookieParser = require("cookie-parser");
const catchErrors = require("./utils/catchErrors");
require("dotenv").config();
const HTTP_STATUS = require("./constants/http");
const routes = require("./routes/index.routes.js");

const app = express();

//convert row strings into js objects
app.use(express.json());

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
app.listen(process.env.PORT, async () => {
  console.log(
    `Server is running on port ${process.env.PORT} in ${process.env.NODE_ENV} mode`
  );
  await connectToDatabase();
});
