// Wrapper to catch async errors in controllers
const catchErrors = (controller) => {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      //pass error to next middleware (to errorHandler in => errorHandler.js)
      next(error);
    }
  };
};

module.exports = catchErrors;
