//Since Express does not handle rejections in asynchronous functions automatically, we catch them here
// and pass them to the  (to errorHandler in => errorHandler.js)
const catchErrors = (controller) => {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      //pass error to next middleware 
      next(error);
    }
  };
};

module.exports = catchErrors;
