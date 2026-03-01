const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { accessoryCategoryValidation, validate } = require('../utils/validators');
const db = require('../config/database');

// All routes require authentication
router.use(authenticate);

// Get all accessory categories
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        category_id,
        category_name
      FROM accessory_categories
      ORDER BY category_name ASC
    `);

    res.json({
      status: 'success',
      data: {
        categories: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Get accessory categories error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch categories',
    });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM accessory_categories WHERE category_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found',
      });
    }

    res.json({
      status: 'success',
      data: { category: result.rows[0] },
    });
  } catch (error) {
    console.error('Get accessory category error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch category',
    });
  }
});

// Create category (admin/manager only)
router.post(
  '/',
  authorize('admin', 'manager'),
  accessoryCategoryValidation,
  validate,
  async (req, res) => {
    try {
      const { category_name } = req.body;

      // Check if exists
      const exists = await db.query(
        'SELECT category_id FROM accessory_categories WHERE LOWER(category_name) = LOWER($1)',
        [category_name]
      );

      if (exists.rows.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Category name already exists',
        });
      }

      const result = await db.query(
        'INSERT INTO accessory_categories (category_name) VALUES ($1) RETURNING *',
        [category_name]
      );

      res.status(201).json({
        status: 'success',
        message: 'Category created successfully',
        data: { category: result.rows[0] },
      });
    } catch (error) {
      console.error('Create accessory category error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create category',
      });
    }
  }
);

// Update category (admin/manager only)
router.put(
  '/:id',
  authorize('admin', 'manager'),
  accessoryCategoryValidation,
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { category_name } = req.body;

      // Check if category exists
      const existing = await db.query(
        'SELECT * FROM accessory_categories WHERE category_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found',
        });
      }

      // Check if new name already exists
      const nameExists = await db.query(
        'SELECT category_id FROM accessory_categories WHERE LOWER(category_name) = LOWER($1) AND category_id != $2',
        [category_name, id]
      );

      if (nameExists.rows.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Category name already exists',
        });
      }

      const result = await db.query(
        'UPDATE accessory_categories SET category_name = $1 WHERE category_id = $2 RETURNING *',
        [category_name, id]
      );

      res.json({
        status: 'success',
        message: 'Category updated successfully',
        data: { category: result.rows[0] },
      });
    } catch (error) {
      console.error('Update accessory category error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update category',
      });
    }
  }
);

// Delete category (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if has accessories
    const hasAccessories = await db.query(
      'SELECT COUNT(*) as count FROM accessories WHERE category_id = $1',
      [id]
    );

    if (parseInt(hasAccessories.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete category with existing accessories',
      });
    }

    const result = await db.query(
      'DELETE FROM accessory_categories WHERE category_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found',
      });
    }

    res.json({
      status: 'success',
      message: 'Category deleted successfully',
      data: { category: result.rows[0] },
    });
  } catch (error) {
    console.error('Delete accessory category error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete category',
    });
  }
});

module.exports = router;