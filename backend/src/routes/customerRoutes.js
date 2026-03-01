const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  customerValidation,
  customerUpdateValidation,
  customerQueryValidation,
  validate,
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// Quick search (for autocomplete)
router.get('/search', CustomerController.quickSearch);

// Get customers with credit
router.get('/credit', CustomerController.getCustomersWithCredit);

// Get all customers
router.get('/', customerQueryValidation, validate, CustomerController.getAll);

// Get customer by ID
router.get('/:id', CustomerController.getById);

// Get purchase history
router.get('/:id/purchases', CustomerController.getPurchaseHistory);

// Create customer
router.post(
  '/',
  authorize('admin', 'manager', 'cashier'),
  customerValidation,
  validate,
  CustomerController.create
);

// Update customer
router.put(
  '/:id',
  authorize('admin', 'manager'),
  customerUpdateValidation,
  validate,
  CustomerController.update
);

// Delete customer
router.delete('/:id', authorize('admin'), CustomerController.delete);

module.exports = router;