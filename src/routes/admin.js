const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All admin routes require authentication and admin role
router.use(auth);
router.use(authorize(['admin']));

// Analytics and statistics
router.get('/usage', adminController.usageStats);
router.get('/earnings', adminController.earnings);
router.get('/health', adminController.health);

// User management
router.get('/users', adminController.getUsers);
router.put('/users/:userId', adminController.updateUser);

module.exports = router;
