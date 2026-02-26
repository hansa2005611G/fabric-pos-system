const FabricModel = require('../models/fabricModel');
const UnitConverter = require('../utils/unitConverter');

class FabricController {
  // Get all fabrics
  static async getAll(req, res) {
    try {
      const { category_id, search, is_active, unit = 'meter' } = req.query;
      const branch_id = req.user.branch_id; // From auth middleware

      // Validate unit
      if (!UnitConverter.isValidUnit(unit)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid unit. Supported: ${UnitConverter.getSupportedUnits().join(', ')}`,
        });
      }

      const fabrics = await FabricModel.getAll(
        { category_id, search, is_active, branch_id },
        unit
      );

      res.json({
        status: 'success',
        data: {
          fabrics,
          count: fabrics.length,
          display_unit: unit,
        },
      });
    } catch (error) {
      console.error('Get fabrics error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch fabrics',
      });
    }
  }

  // Get fabric by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const { unit = 'meter' } = req.query;

      const fabric = await FabricModel.getById(id, unit);

      if (!fabric) {
        return res.status(404).json({
          status: 'error',
          message: 'Fabric not found',
        });
      }

      res.json({
        status: 'success',
        data: { fabric },
      });
    } catch (error) {
      console.error('Get fabric error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch fabric',
      });
    }
  }

  // Create fabric
  static async create(req, res) {
    try {
      const {
        fabric_code,
        fabric_name,
        category_id,
        brand,
        color,
        pattern,
        width_inches,
        gsm,
        cost_price,
        selling_price,
        wholesale_price,
        price_unit = 'meter', // Unit for input prices
        track_by_roll = true,
        description,
        image_url,
      } = req.body;

      // Generate fabric code if not provided
      const finalCode = fabric_code || await FabricModel.generateFabricCode();

      // Check if code already exists
      const codeExists = await FabricModel.existsByCode(finalCode);
      if (codeExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Fabric code already exists',
        });
      }

      // Validate price unit
      if (!UnitConverter.isValidUnit(price_unit)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid price unit. Supported: ${UnitConverter.getSupportedUnits().join(', ')}`,
        });
      }

      const fabric = await FabricModel.create(
        {
          fabric_code: finalCode,
          fabric_name,
          category_id,
          brand,
          color,
          pattern,
          width_inches,
          gsm,
          cost_price,
          selling_price,
          wholesale_price,
          track_by_roll,
          description,
          image_url,
        },
        price_unit
      );

      res.status(201).json({
        status: 'success',
        message: 'Fabric created successfully',
        data: { fabric },
      });
    } catch (error) {
      console.error('Create fabric error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to create fabric',
      });
    }
  }

  // Update fabric
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { price_unit = 'meter' } = req.body;

      // Check if fabric exists
      const existing = await FabricModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Fabric not found',
        });
      }

      // Check if new code conflicts (if provided)
      if (req.body.fabric_code) {
        const codeExists = await FabricModel.existsByCode(req.body.fabric_code, id);
        if (codeExists) {
          return res.status(400).json({
            status: 'error',
            message: 'Fabric code already exists',
          });
        }
      }

      const fabric = await FabricModel.update(id, req.body, price_unit);

      res.json({
        status: 'success',
        message: 'Fabric updated successfully',
        data: { fabric },
      });
    } catch (error) {
      console.error('Update fabric error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to update fabric',
      });
    }
  }

  // Delete fabric
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const existing = await FabricModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Fabric not found',
        });
      }

      const fabric = await FabricModel.delete(id);

      res.json({
        status: 'success',
        message: 'Fabric deleted successfully',
        data: { fabric },
      });
    } catch (error) {
      console.error('Delete fabric error:', error);

      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to delete fabric',
      });
    }
  }

  // Get supported units
  static async getSupportedUnits(req, res) {
    try {
      const units = UnitConverter.getSupportedUnits();
      
      // Example conversions
      const examples = {
        '1 meter equals': {
          yards: UnitConverter.fromMeters(1, 'yard'),
          feet: UnitConverter.fromMeters(1, 'feet'),
          inches: UnitConverter.fromMeters(1, 'inch'),
          centimeters: UnitConverter.fromMeters(1, 'centimeter'),
        },
      };

      res.json({
        status: 'success',
        data: {
          supported_units: units,
          conversions: examples,
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch units',
      });
    }
  }
}

module.exports = FabricController;