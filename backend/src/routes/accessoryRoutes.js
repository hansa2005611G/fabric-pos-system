const express = require('express');
const router = express.Router();
const AccessoryController = require('../controllers/accessoryController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  accessoryValidation,
  accessoryUpdateValidation,
  accessoryStockAdjustmentValidation,
  accessoryQueryValidation,
  validate,
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// Get all accessories (all roles can view)
router.get('/', accessoryQueryValidation, validate, AccessoryController.getAll);

// Get low stock alert
router.get('/alerts/low-stock', AccessoryController.getLowStock);

// Get accessory by ID
router.get('/:id', AccessoryController.getById);

// Get accessory by code
router.get('/code/:code', AccessoryController.getByCode);

// Get transaction history
router.get('/:id/history', AccessoryController.getTransactionHistory);

// Create accessory (admin and manager only)
router.post(
  '/',
  authorize('admin', 'manager'),
  accessoryValidation,
  validate,
  AccessoryController.create
);

// Update accessory (admin and manager only)
router.put(
  '/:id',
  authorize('admin', 'manager'),
  accessoryUpdateValidation,
  validate,
  AccessoryController.update
);

// Add stock (admin and manager only)
router.post(
  '/:id/add',
  authorize('admin', 'manager'),
  accessoryStockAdjustmentValidation,
  validate,
  AccessoryController.addStock
);

// Deduct stock (admin and manager only)
router.post(
  '/:id/deduct',
  authorize('admin', 'manager'),
  accessoryStockAdjustmentValidation,
  validate,
  AccessoryController.deductStock
);

// Delete accessory (admin only)
router.delete('/:id', authorize('admin'), AccessoryController.delete);

module.exports = router;