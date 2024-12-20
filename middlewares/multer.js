const multer = require('multer');
const path = require('path');
const {nanoid} = require('nanoid');
const { MAX_IMG_SIZE } = require('../constants/constants');

const filesStorage = (destination) => multer.diskStorage({
  destination,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${file.fieldname}-${nanoid()}${ext}`;
    cb(null, uniqueName);
  }
});

//TODO: this can be tricked by user, since it doesn't chack the content type
// can use "file-type" package but it only supports mjs
const imageFileFilter = (req, file, cb) => {
  // Allowed file types (both MIME types and extensions)
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.webp'];

  // Extract the MIME type and extension
  const isMimeTypeValid = allowedMimeTypes.includes(file.mimetype);
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const isExtensionValid = allowedExtensions.includes(fileExtension);

  // If both checks pass, allow the file
  if (isMimeTypeValid && isExtensionValid) {
    return cb(null, true);
  }

  // If invalid, set the error message and block the upload
  req.fileValidationError = `Only ${allowedExtensions.join(', ')} files are allowed!`;
  cb(null, false);
};


const pdfFileFilter = (req, file, cb) => {
  // Check the file's MIME type
  const filetypes = /pdf/;
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype) {
    cb(null, true);
  } else {
    req.fileValidationError = 'Only .pdf files are allowed!';
    cb(null, false);
  }
};

// Middleware for uploading profile photos
exports.uploadProfilePhoto = multer({
  limits: { fileSize: MAX_IMG_SIZE },
  storage: filesStorage('uploads/profile'),
  fileFilter: imageFileFilter
}).single('profile');

// Middleware for uploading Product Images
exports.uploadProductImage = multer({
  limits: { fileSize: MAX_IMG_SIZE },
  storage: filesStorage('uploads/product-images'),
  fileFilter: imageFileFilter
}).single('product-image');

// Middleware for uploading Generic(all types of) Images
exports.uploadGenericImage  = multer({
  limits: { fileSize: MAX_IMG_SIZE },
  storage: filesStorage('uploads/generic-images'),
  fileFilter: imageFileFilter
}).single('generic-image');

// Middleware for uploading Product Images
exports.uploadVehicleImage = multer({
  limits: { fileSize: MAX_IMG_SIZE },
  storage: filesStorage('uploads/vehicle-images'),
  fileFilter: imageFileFilter
}).array('vehicle-image');

// Middleware for uploading Product Images
exports.uploadPdf = multer({
  limits: { fileSize: MAX_IMG_SIZE },
  storage: filesStorage('uploads/pdfs'),
  fileFilter: pdfFileFilter
}).single('pdf');



const excelImportStorage = multer.diskStorage({
  destination: 'uploads/excel',
  filename: (req, file, cb) => {
    const ext = file.mimetype.split("/")[1];
    cb(null, `${file.fieldname}-${Date.now()}.${ext}`);
  }
});

exports.importExcel = multer({
  limits: { fileSize: MAX_IMG_SIZE },
  storage: excelImportStorage, fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(csv|xlsx)$/)) {
      req.fileValidationError = "Please upload a valid file"
      return cb(null, false, new Error('Please upload a valid file'))
    }
    cb(undefined, true)
  }
}).single("excel_file");
