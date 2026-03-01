const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Sales summary report
router.get('/sales-summary', ReportController.getSalesSummary);

// Top selling products
router.get('/top-products', ReportController.getTopSellingProducts);

// Monthly report
router.get('/monthly', ReportController.getMonthlyReport);

// Yearly report
router.get('/yearly', ReportController.getYearlyReport);

// Profit analysis
router.get('/profit-analysis', ReportController.getProfitAnalysis);

// Low stock report
router.get('/low-stock', ReportController.getLowStockReport);

// Top customers
router.get('/top-customers', ReportController.getTopCustomers);

// Stock value report (admin only)
router.get('/stock-value', authorize('admin', 'manager'), ReportController.getStockValueReport);

module.exports = router;