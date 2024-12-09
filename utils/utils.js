const HTTP_STATUS = require("../constants/http");
const appAssert = require("./appAssert");
const path = require("path");
const fs = require("fs");

//Methods
const deleteFile = (imagePath) => {
  const fullPath = path.join(process.cwd(), imagePath);

  fs.unlink(fullPath, (err) => {
    if (err) {
      console.error(`Error deleting the file: ${err.message}`);
      return;
    }
    console.log(`File ${imagePath} was deleted successfully`);
  });
};

const checkPhoneNumberValidity = (phone) => {
  // Check if phone number is null, undefined, or empty
  if (!phone) {
    return false;
  }

  // Check if phone number length is exactly 10 digits
  if (phone.length !== 10) {
    return false;
  }

  // Check if phone number starts with 09 or 07
  const isValidStart = /^(09|07)/.test(phone);
  return isValidStart;
};

const hasDuplicates = (arr) => {
  return new Set(arr).size !== arr.length;
};

const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date);
};

const validateRequiredFields = (fields) => {
  Object.entries(fields).forEach(([key, value]) => {
    //format the field name
    const formattedKey = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    //assert the field has value
    appAssert(value, HTTP_STATUS.BAD_REQUEST, `${formattedKey} is required!`);
  });
};

module.exports = {
  deleteFile,
  checkPhoneNumberValidity,
  hasDuplicates,
  isValidDate,
  validateRequiredFields,
};
