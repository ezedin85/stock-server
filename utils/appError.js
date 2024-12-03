// a custom error class that extends the built-in Error class
// Used to distinguish app-specific errors from other errors.
class AppError extends Error {
  constructor(statusCode, message, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errorCode = errorCode;
  }
}

module.exports = AppError;
