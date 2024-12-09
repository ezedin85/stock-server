const multer = require('multer');
const path = require('path');
const {nanoid} = require('nanoid');

const filesStorage = (destination) => multer.diskStorage({
  destination,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${file.fieldname}-${nanoid()}${ext}`;
    cb(null, uniqueName);
  }
});

const imageFileFilter = (req, file, cb) => {
  // Check the file's MIME type
  const filetypes = /jpeg|jpg|png/;
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype) {
    cb(null, true);
  } else {
    req.fileValidationError = 'Only .jpg, .jpeg, and .png files are allowed!';
    cb(null, false);
  }
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
  storage: filesStorage('uploads/profile'),
  fileFilter: imageFileFilter
}).single('profile');

// Middleware for uploading Product Images
exports.uploadProductImage = multer({
  storage: filesStorage('uploads/product-images'),
  fileFilter: imageFileFilter
}).single('product-image');

// Middleware for uploading Generic(all types of) Images
exports.uploadGenericImage  = multer({
  storage: filesStorage('uploads/generic-images'),
  fileFilter: imageFileFilter
}).single('generic-image');

// Middleware for uploading Product Images
exports.uploadVehicleImage = multer({
  storage: filesStorage('uploads/vehicle-images'),
  fileFilter: imageFileFilter
}).array('vehicle-image');

// Middleware for uploading Product Images
exports.uploadPdf = multer({
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
  storage: excelImportStorage, fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(csv|xlsx)$/)) {
      req.fileValidationError = "Please upload a valid file"
      return cb(null, false, new Error('Please upload a valid file'))
    }
    cb(undefined, true)
  }
}).single("excel_file");
