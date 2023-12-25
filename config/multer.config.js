const path = require('path');
const multer = require('multer');

function multerConfig(uploadPath) {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
  });

  return multer({ storage: storage });
}

module.exports = multerConfig;