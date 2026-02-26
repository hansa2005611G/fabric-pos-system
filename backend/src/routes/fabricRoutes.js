const express = require('express');
const router = express.Router();
const FabricController = require('../controllers/fabricController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  fabricValidation, 
  fabricUpdateValidation,
  fabricQueryValidation,
  validate 
} = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// Get supported units (public utility endpoint)
router.get('/units', FabricController.getSupportedUnits);

// Get all fabrics (all roles can view)
router.get(
  '/',
  fabricQueryValidation,
  validate,
  FabricController.getAll
);

// Get fabric by ID
router.get('/:id', FabricController.getById);

// Create fabric (admin and manager only)
router.post(
  '/',
  authorize('admin', 'manager'),
  fabricValidation,
  validate,
  FabricController.create
);

// Update fabric (admin and manager only)
router.put(
  '/:id',
  authorize('admin', 'manager'),
  fabricUpdateValidation,
  validate,
  FabricController.update
);

// Delete fabric (admin only)
router.delete(
  '/:id',
  authorize('admin'),
  FabricController.delete
);

module.exports = router;