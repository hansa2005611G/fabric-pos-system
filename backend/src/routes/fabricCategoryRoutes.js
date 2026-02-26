const express = require('express');
const router = express.Router();
const FabricCategoryController = require('../controllers/fabricCategoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { fabricCategoryValidation, validate } = require('../utils/validators');

// All routes require authentication
router.use(authenticate);

// Get all categories (all roles can view)
router.get('/', FabricCategoryController.getAll);

// Get category by ID
router.get('/:id', FabricCategoryController.getById);

// Create category (admin and manager only)
router.post(
  '/',
  authorize('admin', 'manager'),
  fabricCategoryValidation,
  validate,
  FabricCategoryController.create
);

// Update category (admin and manager only)
router.put(
  '/:id',
  authorize('admin', 'manager'),
  fabricCategoryValidation,
  validate,
  FabricCategoryController.update
);

// Delete category (admin only)
router.delete(
  '/:id',
  authorize('admin'),
  FabricCategoryController.delete
);

module.exports = router;