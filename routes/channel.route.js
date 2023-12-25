const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const multerConfig = require('../config/multer.config');

// /api/channels/

const upload = multerConfig('./uploads/img');
router.put('/', upload.fields([
  { name: 'profile', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), channelController.updateChannel);

router.post('/', channelController.addChannel);
router.get('/:id', channelController.getChannel);
router.delete('/', channelController.deleteChannel);

module.exports = router;


