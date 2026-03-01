const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Main dashboard statistics
router.get('/stats', DashboardController.getDashboardStats);

// Sales trend (last N days)
router.get('/sales-trend', DashboardController.getSalesTrend);

// Payment method breakdown
router.get('/payment-breakdown', DashboardController.getPaymentMethodBreakdown);

// Hourly sales (today)
router.get('/hourly-sales', DashboardController.getHourlySales);

// Alerts
router.get('/alerts', DashboardController.getAlerts);

// Quick stats (lightweight)
router.get('/quick-stats', DashboardController.getQuickStats);

module.exports = router;