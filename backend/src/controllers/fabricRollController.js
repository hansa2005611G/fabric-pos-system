const FabricRollModel = require('../models/fabricRollModel');
const UnitConverter = require('../utils/unitConverter');

class FabricRollController {
  // Get all rolls
  static async getAll(req, res) {
    try {
      const {
        fabric_id,
        status,
        search,
        low_stock_only,
        min_meters,
        unit = 'meter',
      } = req.query;

      const branch_id = req.user.branch_id;

      // Validate unit
      if (!UnitConverter.isValidUnit(unit)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid unit. Supported: ${UnitConverter.getSupportedUnits().join(', ')}`,
        });
      }

      const rolls = await FabricRollModel.getAll(
        {
          fabric_id,
          branch_id,
          status,
          search,
          low_stock_only: low_stock_only === 'true',
          min_meters: min_meters ? parseFloat(min_meters) : 0,
        },
        unit
      );

      res.json({
        status: 'success',
        data: {
          rolls,
          count: rolls.length,
          display_unit: unit,
        },
      });
    } catch (error) {
      console.error('Get rolls error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch rolls',
      });
    }
  }

  // Get roll by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const { unit = 'meter' } = req.query;

      const roll = await FabricRollModel.getById(id, unit);

      if (!roll) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      res.json({
        status: 'success',
        data: { roll },
      });
    } catch (error) {
      console.error('Get roll error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch roll',
      });
    }
  }

  // Get roll by code
  static async getByCode(req, res) {
    try {
      const { code } = req.params;
      const { unit = 'meter' } = req.query;

      const roll = await FabricRollModel.getByCode(code, unit);

      if (!roll) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      res.json({
        status: 'success',
        data: { roll },
      });
    } catch (error) {
      console.error('Get roll by code error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch roll',
      });
    }
  }

  // Create new roll (purchase entry)
  static async create(req, res) {
    try {
      const {
        roll_code,
        fabric_id,
        initial_quantity,
        quantity_unit = 'meter',
        rack_location,
        supplier_name,
        purchase_date,
        purchase_cost_per_unit,
        cost_unit = 'meter',
      } = req.body;

      const branch_id = req.user.branch_id;
      const user_id = req.user.user_id;

      // Generate roll code if not provided
      const finalCode = roll_code || (await FabricRollModel.generateRollCode(fabric_id));

      // Check if code exists
      const codeExists = await FabricRollModel.existsByCode(finalCode);
      if (codeExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Roll code already exists',
        });
      }

      // Validate units
      if (!UnitConverter.isValidUnit(quantity_unit)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid quantity unit. Supported: ${UnitConverter.getSupportedUnits().join(', ')}`,
        });
      }

      if (!UnitConverter.isValidUnit(cost_unit)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid cost unit. Supported: ${UnitConverter.getSupportedUnits().join(', ')}`,
        });
      }

      const roll = await FabricRollModel.create(
        {
          roll_code: finalCode,
          fabric_id,
          branch_id,
          initial_quantity,
          rack_location,
          supplier_name,
          purchase_date,
          purchase_cost_per_unit,
          cost_unit,
        },
        quantity_unit,
        user_id
      );

      res.status(201).json({
        status: 'success',
        message: 'Roll created successfully',
        data: { roll },
      });
    } catch (error) {
      console.error('Create roll error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to create roll',
      });
    }
  }

  // Update roll details
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { rack_location, supplier_name, purchase_date, purchase_cost_per_meter, status } = req.body;

      // Check if roll exists
      const existing = await FabricRollModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      const roll = await FabricRollModel.update(id, {
        rack_location,
        supplier_name,
        purchase_date,
        purchase_cost_per_meter,
        status,
      });

      res.json({
        status: 'success',
        message: 'Roll updated successfully',
        data: { roll },
      });
    } catch (error) {
      console.error('Update roll error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to update roll',
      });
    }
  }

  // Deduct meters (manual adjustment)
  static async deductMeters(req, res) {
    try {
      const { id } = req.params;
      const { quantity, unit = 'meter', reason } = req.body;
      const user_id = req.user.user_id;

      // Check if roll exists
      const existing = await FabricRollModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      // Validate unit
      if (!UnitConverter.isValidUnit(unit)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid unit. Supported: ${UnitConverter.getSupportedUnits().join(', ')}`,
        });
      }

      const roll = await FabricRollModel.deductMeters(
        id,
        quantity,
        unit,
        user_id,
        'adjustment',
        null
      );

      res.json({
        status: 'success',
        message: 'Meters deducted successfully',
        data: {
          roll,
          deducted: {
            quantity,
            unit,
            reason: reason || 'Manual adjustment',
          },
        },
      });
    } catch (error) {
      console.error('Deduct meters error:', error);

      if (error.message.includes('Insufficient stock') || error.message.includes('Cannot deduct')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to deduct meters',
      });
    }
  }

  // Add meters (return, adjustment)
  static async addMeters(req, res) {
    try {
      const { id } = req.params;
      const { quantity, unit = 'meter', reason } = req.body;
      const user_id = req.user.user_id;

      // Check if roll exists
      const existing = await FabricRollModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      // Validate unit
      if (!UnitConverter.isValidUnit(unit)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid unit. Supported: ${UnitConverter.getSupportedUnits().join(', ')}`,
        });
      }

      if (!reason) {
        return res.status(400).json({
          status: 'error',
          message: 'Reason is required for adding meters',
        });
      }

      const roll = await FabricRollModel.addMeters(id, quantity, unit, user_id, reason);

      res.json({
        status: 'success',
        message: 'Meters added successfully',
        data: {
          roll,
          added: {
            quantity,
            unit,
            reason,
          },
        },
      });
    } catch (error) {
      console.error('Add meters error:', error);

      if (error.message.includes('Cannot add')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to add meters',
      });
    }
  }

  // Mark roll as damaged
  static async markAsDamaged(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user_id = req.user.user_id;

      // Check if roll exists
      const existing = await FabricRollModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      if (!reason) {
        return res.status(400).json({
          status: 'error',
          message: 'Reason is required for marking roll as damaged',
        });
      }

      await FabricRollModel.markAsDamaged(id, user_id, reason);

      res.json({
        status: 'success',
        message: 'Roll marked as damaged',
        data: {
          roll_id: id,
          reason,
        },
      });
    } catch (error) {
      console.error('Mark damaged error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to mark roll as damaged',
      });
    }
  }

  // Get transaction history for a roll
  static async getTransactionHistory(req, res) {
    try {
      const { id } = req.params;

      // Check if roll exists
      const existing = await FabricRollModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      const transactions = await FabricRollModel.getTransactionHistory(id);

      res.json({
        status: 'success',
        data: {
          roll_id: id,
          roll_code: existing.roll_code,
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

  // Get low stock rolls (alert endpoint)
  static async getLowStock(req, res) {
    try {
      const { unit = 'meter' } = req.query;
      const branch_id = req.user.branch_id;

      const rolls = await FabricRollModel.getAll(
        {
          branch_id,
          status: 'active',
          low_stock_only: true,
        },
        unit
      );

      res.json({
        status: 'success',
        data: {
          rolls,
          count: rolls.length,
          alert: rolls.length > 0 ? 'Low stock detected' : 'No low stock items',
        },
      });
    } catch (error) {
      console.error('Get low stock error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch low stock rolls',
      });
    }
  }
}

module.exports = FabricRollController;