const express = require('express');
const router = express.Router();
const SalesController = require('../controllers/salesController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  saleValidation,
  saleStatusValidation,
  addPaymentValidation,
  salesQueryValidation,
  validate,
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// Get all sales (all roles can view)
router.get('/', salesQueryValidation, validate, SalesController.getAll);

// Get daily summary
router.get('/reports/daily-summary', SalesController.getDailySummary);

// Get sales by date range
router.get('/reports/date-range', SalesController.getSalesByDateRange);

// Get sale by ID
router.get('/:id', SalesController.getById);

// Get sale by invoice number
router.get('/invoice/:invoice_number', SalesController.getByInvoiceNumber);

// Create new sale (all roles except storekeeper)
router.post(
  '/',
  authorize('admin', 'manager', 'cashier'),
  saleValidation,
  validate,
  SalesController.create
);

// Update sale status (admin and manager only)
router.patch(
  '/:id/status',
  authorize('admin', 'manager'),
  saleStatusValidation,
  validate,
  SalesController.updateStatus
);

// Add payment to credit sale (admin and manager only)
router.post(
  '/:id/payment',
  authorize('admin', 'manager'),
  addPaymentValidation,
  validate,
  SalesController.addPayment
);

module.exports = router;