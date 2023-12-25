const express = require('express')
const router = express.Router()
const videoController = require('../controllers/videoController')
const multerConfig = require('../config/multer.config');

//  /api/videos

const upload = multerConfig('./uploads/videos');
router.post('/', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]), videoController.uploadVideo);

router.get('/', videoController.getVideos);
router.get('/channel-videos/:id', videoController.getChannelVideos);
router.get('/subscriptions', videoController.getSubscriptionsVideos);
router.get('/liked', videoController.getLikedVideos);
router.get('/searched/:query', videoController.getSearchedVideos);

router.get('/watch/:id', videoController.watchVideo);


module.exports = router;