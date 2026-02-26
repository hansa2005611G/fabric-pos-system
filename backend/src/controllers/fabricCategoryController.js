const FabricCategoryModel = require('../models/fabricCategoryModel');

class FabricCategoryController {
  // Get all categories
  static async getAll(req, res) {
    try {
      const categories = await FabricCategoryModel.getAll();
      
      res.json({
        status: 'success',
        data: {
          categories,
          count: categories.length,
        },
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch categories',
      });
    }
  }

  // Get category by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const category = await FabricCategoryModel.getById(id);
      
      if (!category) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found',
        });
      }
      
      res.json({
        status: 'success',
        data: { category },
      });
    } catch (error) {
      console.error('Get category error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch category',
      });
    }
  }

  // Create category
  static async create(req, res) {
    try {
      const { category_name, description } = req.body;
      
      // Check if category name already exists
      const exists = await FabricCategoryModel.existsByName(category_name);
      if (exists) {
        return res.status(400).json({
          status: 'error',
          message: 'Category name already exists',
        });
      }
      
      const category = await FabricCategoryModel.create({
        category_name,
        description,
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Category created successfully',
        data: { category },
      });
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create category',
      });
    }
  }

  // Update category
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { category_name, description } = req.body;
      
      // Check if category exists
      const existingCategory = await FabricCategoryModel.getById(id);
      if (!existingCategory) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found',
        });
      }
      
      // Check if new name already exists (excluding current category)
      if (category_name) {
        const nameExists = await FabricCategoryModel.existsByName(
          category_name,
          id
        );
        if (nameExists) {
          return res.status(400).json({
            status: 'error',
            message: 'Category name already exists',
          });
        }
      }
      
      const category = await FabricCategoryModel.update(id, {
        category_name,
        description,
      });
      
      res.json({
        status: 'success',
        message: 'Category updated successfully',
        data: { category },
      });
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update category',
      });
    }
  }

  // Delete category
  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Check if category exists
      const existingCategory = await FabricCategoryModel.getById(id);
      if (!existingCategory) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found',
        });
      }
      
      const category = await FabricCategoryModel.delete(id);
      
      res.json({
        status: 'success',
        message: 'Category deleted successfully',
        data: { category },
      });
    } catch (error) {
      console.error('Delete category error:', error);
      
      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete category',
      });
    }
  }
}

module.exports = FabricCategoryController;