const express = require('express');
const router = express.Router();
const FabricRollController = require('../controllers/fabricRollController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  fabricRollValidation,
  fabricRollUpdateValidation,
  meterAdjustmentValidation,
  markDamagedValidation,
  fabricRollQueryValidation,
  validate,
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// Get all rolls (all roles can view)
router.get(
  '/',
  fabricRollQueryValidation,
  validate,
  FabricRollController.getAll
);

// Get low stock alert
router.get('/alerts/low-stock', FabricRollController.getLowStock);

// Get roll by ID
router.get('/:id', FabricRollController.getById);

// Get roll by code
router.get('/code/:code', FabricRollController.getByCode);

// Get transaction history for a roll
router.get('/:id/history', FabricRollController.getTransactionHistory);

// Create new roll (admin and manager only)
router.post(
  '/',
  authorize('admin', 'manager'),
  fabricRollValidation,
  validate,
  FabricRollController.create
);

// Update roll details (admin and manager only)
router.put(
  '/:id',
  authorize('admin', 'manager'),
  fabricRollUpdateValidation,
  validate,
  FabricRollController.update
);

// Deduct meters - manual adjustment (admin and manager only)
router.post(
  '/:id/deduct',
  authorize('admin', 'manager'),
  meterAdjustmentValidation,
  validate,
  FabricRollController.deductMeters
);

// Add meters - return/adjustment (admin and manager only)
router.post(
  '/:id/add',
  authorize('admin', 'manager'),
  meterAdjustmentValidation,
  validate,
  FabricRollController.addMeters
);

// Mark roll as damaged (admin only)
router.post(
  '/:id/damage',
  authorize('admin'),
  markDamagedValidation,
  validate,
  FabricRollController.markAsDamaged
);

module.exports = router;