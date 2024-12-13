/**
 * Database Connection Configurations.
 * */
const mongoose = require("mongoose");
require("dotenv").config();


mongoose.connect(process.env.MONGO_URI)
    .then(()=>{console.log(`Connceted to database.`);})
    .catch(err=>console.log(err))

mongoose.set("runValidators", true); 
module.exports = mongoose;
