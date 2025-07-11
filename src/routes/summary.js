const express = require('express');
const router = express.Router();
const summaryController = require('../controllers/summaryController');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// Generate single summary
router.post('/', auth, rateLimit, summaryController.getSummary);

// Generate batch summaries (requires premium plan or higher)
router.post('/batch', auth, rateLimit, summaryController.getBatchSummaries);

// Get user's summary history
router.get('/history', auth, summaryController.getSummaryHistory);

module.exports = router;
