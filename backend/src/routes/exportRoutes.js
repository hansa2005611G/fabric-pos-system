const express = require('express');
const router = express.Router();
const ExportController = require('../controllers/exportController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Export sales report
router.get('/sales/pdf', ExportController.exportSalesPDF);
router.get('/sales/excel', ExportController.exportSalesExcel);

// Export invoice
router.get('/invoice/:invoice_number/pdf', ExportController.exportInvoicePDF);

// Export stock report
router.get('/stock/excel', authorize('admin', 'manager'), ExportController.exportStockExcel);

// Export customers
router.get('/customers/excel', authorize('admin', 'manager'), ExportController.exportCustomersExcel);

module.exports = router;