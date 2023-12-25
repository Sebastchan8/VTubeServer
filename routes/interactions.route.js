const express = require('express');
const router = express.Router();
const interactionsController = require('../controllers/interactionsController');

// /api/interactions/

router.post('/subscribe', interactionsController.subscribe);
router.post('/unsubscribe', interactionsController.unsubscribe);

router.post('/rate', interactionsController.rateItem);

router.post('/views', interactionsController.addViewsCounter);

router.post('/comments', interactionsController.addComment);

router.post('/login', interactionsController.login);
router.get('/logout', interactionsController.logout);
router.post('/signup', interactionsController.signup);

module.exports = router;
