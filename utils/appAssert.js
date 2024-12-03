const assert = require("node:assert");
const AppError = require("./AppError");

/**
 * Asserts a condition and throws an AppError if the condition is falsy.
 * @param {any} condition - The condition to check.
 * @param {number} httpStatusCode - The HTTP status code for the error.
 * @param {string} message - The error message.
 * @param {string} [appErrorCode] - Optional application error code.
 */
const appAssert = (condition, httpStatusCode, message, appErrorCode) => {
  assert(condition, new AppError(httpStatusCode, message, appErrorCode));
};
 
module.exports = appAssert;
