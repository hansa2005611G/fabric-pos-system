const AccessoryModel = require('../models/accessoryModel');

class AccessoryController {
  // Get all accessories
  static async getAll(req, res) {
    try {
      const { category_id, search, is_active, low_stock_only } = req.query;
      const branch_id = req.user.branch_id;

      const accessories = await AccessoryModel.getAll({
        category_id,
        search,
        is_active: is_active !== undefined ? is_active === 'true' : undefined,
        low_stock_only: low_stock_only === 'true',
        branch_id,
      });

      res.json({
        status: 'success',
        data: {
          accessories,
          count: accessories.length,
        },
      });
    } catch (error) {
      console.error('Get accessories error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch accessories',
      });
    }
  }

  // Get accessory by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const accessory = await AccessoryModel.getById(id);

      if (!accessory) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      res.json({
        status: 'success',
        data: { accessory },
      });
    } catch (error) {
      console.error('Get accessory error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch accessory',
      });
    }
  }

  // Get accessory by code
  static async getByCode(req, res) {
    try {
      const { code } = req.params;

      const accessory = await AccessoryModel.getByCode(code);

      if (!accessory) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      res.json({
        status: 'success',
        data: { accessory },
      });
    } catch (error) {
      console.error('Get accessory by code error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch accessory',
      });
    }
  }

  // Create accessory
  static async create(req, res) {
    try {
      const {
        accessory_code,
        accessory_name,
        category_id,
        unit,
        pieces_per_pack,
        cost_price,
        selling_price,
        current_stock,
        min_stock_level,
        description,
      } = req.body;

      const branch_id = req.user.branch_id;

      // Generate code if not provided
      const finalCode = accessory_code || (await AccessoryModel.generateAccessoryCode(category_id));

      // Check if code exists
      const codeExists = await AccessoryModel.existsByCode(finalCode);
      if (codeExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Accessory code already exists',
        });
      }

      const accessory = await AccessoryModel.create(
        {
          accessory_code: finalCode,
          accessory_name,
          category_id,
          unit,
          pieces_per_pack,
          cost_price,
          selling_price,
          current_stock,
          min_stock_level,
          description,
        },
        branch_id
      );

      res.status(201).json({
        status: 'success',
        message: 'Accessory created successfully',
        data: { accessory },
      });
    } catch (error) {
      console.error('Create accessory error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to create accessory',
      });
    }
  }

  // Update accessory
  static async update(req, res) {
    try {
      const { id } = req.params;

      // Check if exists
      const existing = await AccessoryModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      // Check if new code conflicts
      if (req.body.accessory_code) {
        const codeExists = await AccessoryModel.existsByCode(req.body.accessory_code, id);
        if (codeExists) {
          return res.status(400).json({
            status: 'error',
            message: 'Accessory code already exists',
          });
        }
      }

      const accessory = await AccessoryModel.update(id, req.body);

      res.json({
        status: 'success',
        message: 'Accessory updated successfully',
        data: { accessory },
      });
    } catch (error) {
      console.error('Update accessory error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to update accessory',
      });
    }
  }

  // Add stock
  static async addStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity, reason } = req.body;
      const user_id = req.user.user_id;

      const existing = await AccessoryModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      const accessory = await AccessoryModel.addStock(id, quantity, user_id, 'adjustment', null);

      res.json({
        status: 'success',
        message: 'Stock added successfully',
        data: {
          accessory,
          added: {
            quantity,
            reason: reason || 'Manual adjustment',
          },
        },
      });
    } catch (error) {
      console.error('Add stock error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to add stock',
      });
    }
  }

  // Deduct stock
  static async deductStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity, reason } = req.body;
      const user_id = req.user.user_id;

      const existing = await AccessoryModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      const accessory = await AccessoryModel.deductStock(id, quantity, user_id, 'adjustment', null);

      res.json({
        status: 'success',
        message: 'Stock deducted successfully',
        data: {
          accessory,
          deducted: {
            quantity,
            reason: reason || 'Manual adjustment',
          },
        },
      });
    } catch (error) {
      console.error('Deduct stock error:', error);

      if (error.message.includes('Insufficient stock') || error.message.includes('Cannot deduct')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to deduct stock',
      });
    }
  }

  // Delete accessory
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const existing = await AccessoryModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      const accessory = await AccessoryModel.delete(id);

      res.json({
        status: 'success',
        message: 'Accessory deleted successfully',
        data: { accessory },
      });
    } catch (error) {
      console.error('Delete accessory error:', error);

      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to delete accessory',
      });
    }
  }

  // Get transaction history
  static async getTransactionHistory(req, res) {
    try {
      const { id } = req.params;

      const existing = await AccessoryModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      const transactions = await AccessoryModel.getTransactionHistory(id);

      res.json({
        status: 'success',
        data: {
          accessory_id: id,
          accessory_code: existing.accessory_code,
          transactions,
          count: transactions.length,
        },
      });
    } catch (error) {
      console.error('Get transaction history error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch transaction history',
      });
    }
  }

  // Get low stock alert
  static async getLowStock(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const accessories = await AccessoryModel.getLowStock(branch_id);

      res.json({
        status: 'success',
        data: {
          accessories,
          count: accessories.length,
          alert: accessories.length > 0 ? 'Low stock detected' : 'All accessories have sufficient stock',
        },
      });
    } catch (error) {
      console.error('Get low stock error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch low stock accessories',
      });
    }
  }
}

module.exports = AccessoryController;