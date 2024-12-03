const mongoose = require("mongoose");

const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Successfully connected to DB");
  } catch (error) {
    console.error("Could not connect to DB", error);
    process.exit(1);
  }
};

module.exports = connectToDatabase;