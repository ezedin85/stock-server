const HTTP_STATUS = require("../constants/http");
const appAssert = require("./appAssert");
const path = require("path");
const fs = require("fs");
const AppError = require("./AppError");

//Methods
const deleteFile = (imagePath) => {
  const fullPath = path.join(process.cwd(), imagePath);

  fs.access(fullPath, fs.constants.F_OK, (accessErr) => {
    if (accessErr) {
      console.log(
        `🔻File not found: ${imagePath}. It may have already been deleted.`
      );
      return;
    }

    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr) {
        console.log(
          `🔻Failed to delete file: ${imagePath}. Error: ${unlinkErr.message}`
        );
        return;
      }
      console.log(`🔹File ${imagePath} was deleted successfully`);
    });
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

const normalize = (value) => (value === "null" || value === "" ? null : value);

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

const validateNumberFields = (fields, requiredFields = []) => {
  Object.entries(fields).forEach(([key, value]) => {
    // Format the field name
    const formattedKey = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    // Convert the value to a number
    const numericValue = value == null ? value : Number(value);

    console.log(requiredFields);
    
    // if required, make sure, its number and is greter than 0
    if (requiredFields.includes(key)) {
      if (numericValue == null || isNaN(numericValue) || numericValue <= 0) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          `${formattedKey} is required and must be a valid positive number greater than 0!`
        );
      }
    } else {
      //if not required, just make sure its not negative number
      if (numericValue < 0) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          `${formattedKey} must not be a negative number!`
        );
      }
    }
  });
};

module.exports = {
  deleteFile,
  checkPhoneNumberValidity,
  hasDuplicates,
  isValidDate,
  validateRequiredFields,
  validateNumberFields,
  normalize,
};
