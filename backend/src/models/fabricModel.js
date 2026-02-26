const db = require('../config/database');
const UnitConverter = require('../utils/unitConverter');

class FabricModel {
  /**
   * Get all fabrics with optional filters
   * @param {object} filters - Search filters
   * @param {string} displayUnit - Unit for display (default: meter)
   * @returns {array} List of fabrics
   */
  static async getAll(filters = {}, displayUnit = 'meter') {
    const { 
      category_id, 
      search, 
      is_active, 
      branch_id 
    } = filters;

    let query = `
      SELECT 
        f.fabric_id,
        f.fabric_code,
        f.fabric_name,
        f.category_id,
        fc.category_name,
        f.brand,
        f.color,
        f.pattern,
        f.width_inches,
        f.gsm,
        f.cost_price_per_meter,
        f.selling_price_per_meter,
        f.wholesale_price_per_meter,
        f.track_by_roll,
        f.description,
        f.image_url,
        f.is_active,
        f.created_at,
        -- Calculate total stock across all rolls
        COALESCE(SUM(CASE 
          WHEN fr.status = 'active' AND fr.branch_id = COALESCE($1, fr.branch_id)
          THEN fr.remaining_meters 
          ELSE 0 
        END), 0) as total_stock_meters,
        COUNT(DISTINCT CASE 
          WHEN fr.status = 'active' AND fr.branch_id = COALESCE($1, fr.branch_id)
          THEN fr.roll_id 
        END) as active_rolls
      FROM fabrics f
      LEFT JOIN fabric_categories fc ON f.category_id = fc.category_id
      LEFT JOIN fabric_rolls fr ON f.fabric_id = fr.fabric_id
      WHERE 1=1
    `;

    const params = [branch_id || null];
    let paramCount = 1;

    // Filter by category
    if (category_id) {
      paramCount++;
      query += ` AND f.category_id = $${paramCount}`;
      params.push(category_id);
    }

    // Filter by active status
    if (is_active !== undefined) {
      paramCount++;
      query += ` AND f.is_active = $${paramCount}`;
      params.push(is_active);
    }

    // Search by name, code, brand, or color
    if (search) {
      paramCount++;
      query += ` AND (
        f.fabric_name ILIKE $${paramCount} OR 
        f.fabric_code ILIKE $${paramCount} OR
        f.brand ILIKE $${paramCount} OR
        f.color ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    query += `
      GROUP BY f.fabric_id, fc.category_name
      ORDER BY f.fabric_name ASC
    `;

    const result = await db.query(query, params);
    
    // Add unit conversions
    return result.rows.map(fabric => this._addUnitConversions(fabric, displayUnit));
  }

  /**
   * Get fabric by ID
   */
  static async getById(fabricId, displayUnit = 'meter') {
    const query = `
      SELECT 
        f.fabric_id,
        f.fabric_code,
        f.fabric_name,
        f.category_id,
        fc.category_name,
        f.brand,
        f.color,
        f.pattern,
        f.width_inches,
        f.gsm,
        f.cost_price_per_meter,
        f.selling_price_per_meter,
        f.wholesale_price_per_meter,
        f.track_by_roll,
        f.description,
        f.image_url,
        f.is_active,
        f.created_at,
        f.updated_at
      FROM fabrics f
      LEFT JOIN fabric_categories fc ON f.category_id = fc.category_id
      WHERE f.fabric_id = $1
    `;

    const result = await db.query(query, [fabricId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this._addUnitConversions(result.rows[0], displayUnit);
  }

  /**
   * Create new fabric
   * @param {object} data - Fabric data
   * @param {string} priceUnit - Unit for prices (default: meter)
   */
  static async create(data, priceUnit = 'meter') {
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
      track_by_roll = true,
      description,
      image_url,
    } = data;

    // Convert prices to per-meter if needed
    const costPerMeter = UnitConverter.toMeters(cost_price, priceUnit) * cost_price / cost_price;
    const sellingPerMeter = UnitConverter.toMeters(selling_price, priceUnit) * selling_price / selling_price;
    const wholesalePerMeter = wholesale_price ? UnitConverter.toMeters(wholesale_price, priceUnit) * wholesale_price / wholesale_price : null;

    // Actually, prices should be converted differently - price per unit
    // Let's fix this:
    const meterRatio = UnitConverter.toMeters(1, priceUnit);
    const actualCostPerMeter = cost_price / meterRatio;
    const actualSellingPerMeter = selling_price / meterRatio;
    const actualWholesalePerMeter = wholesale_price ? wholesale_price / meterRatio : null;

    const query = `
      INSERT INTO fabrics (
        fabric_code, fabric_name, category_id, brand, color, pattern,
        width_inches, gsm, cost_price_per_meter, selling_price_per_meter,
        wholesale_price_per_meter, track_by_roll, description, image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const result = await db.query(query, [
      fabric_code,
      fabric_name,
      category_id,
      brand || null,
      color || null,
      pattern || null,
      width_inches || null,
      gsm || null,
      actualCostPerMeter,
      actualSellingPerMeter,
      actualWholesalePerMeter,
      track_by_roll,
      description || null,
      image_url || null,
    ]);

    return result.rows[0];
  }

  /**
   * Update fabric
   */
  static async update(fabricId, data, priceUnit = 'meter') {
    const fields = [];
    const values = [];
    let paramCount = 0;

    // Build dynamic update query
    const updateFields = {
      fabric_name: data.fabric_name,
      category_id: data.category_id,
      brand: data.brand,
      color: data.color,
      pattern: data.pattern,
      width_inches: data.width_inches,
      gsm: data.gsm,
      description: data.description,
      image_url: data.image_url,
      is_active: data.is_active,
    };

    // Handle price updates with unit conversion
    if (data.cost_price !== undefined) {
      const meterRatio = UnitConverter.toMeters(1, priceUnit);
      updateFields.cost_price_per_meter = data.cost_price / meterRatio;
    }
    if (data.selling_price !== undefined) {
      const meterRatio = UnitConverter.toMeters(1, priceUnit);
      updateFields.selling_price_per_meter = data.selling_price / meterRatio;
    }
    if (data.wholesale_price !== undefined) {
      const meterRatio = UnitConverter.toMeters(1, priceUnit);
      updateFields.wholesale_price_per_meter = data.wholesale_price / meterRatio;
    }

    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updateFields[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at
    paramCount++;
    fields.push(`updated_at = NOW()`);

    // Add fabric_id for WHERE clause
    paramCount++;
    values.push(fabricId);

    const query = `
      UPDATE fabrics
      SET ${fields.join(', ')}
      WHERE fabric_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete fabric (soft delete - mark as inactive)
   */
  static async delete(fabricId) {
    // Check if fabric has rolls with stock
    const stockCheck = await db.query(
      `SELECT SUM(remaining_meters) as total_stock
       FROM fabric_rolls
       WHERE fabric_id = $1 AND status = 'active'`,
      [fabricId]
    );

    if (parseFloat(stockCheck.rows[0].total_stock) > 0) {
      throw new Error('Cannot delete fabric with remaining stock. Please finish or adjust stock first.');
    }

    const query = `
      UPDATE fabrics
      SET is_active = false, updated_at = NOW()
      WHERE fabric_id = $1
      RETURNING fabric_id, fabric_code, fabric_name
    `;

    const result = await db.query(query, [fabricId]);
    return result.rows[0];
  }

  /**
   * Check if fabric code exists
   */
  static async existsByCode(fabricCode, excludeId = null) {
    let query = `
      SELECT fabric_id
      FROM fabrics
      WHERE fabric_code = $1
    `;

    const params = [fabricCode];

    if (excludeId) {
      query += ` AND fabric_id != $2`;
      params.push(excludeId);
    }

    const result = await db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Generate next fabric code
   * Format: FAB-YYYYMMDD-NNN
   */
  static async generateFabricCode() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `FAB-${dateStr}`;

    const query = `
      SELECT fabric_code
      FROM fabrics
      WHERE fabric_code LIKE $1
      ORDER BY fabric_code DESC
      LIMIT 1
    `;

    const result = await db.query(query, [`${prefix}-%`]);

    if (result.rows.length === 0) {
      return `${prefix}-001`;
    }

    // Extract number and increment
    const lastCode = result.rows[0].fabric_code;
    const lastNumber = parseInt(lastCode.split('-').pop());
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');

    return `${prefix}-${nextNumber}`;
  }

  /**
   * Add unit conversions to fabric object
   * @private
   */
  static _addUnitConversions(fabric, displayUnit = 'meter') {
    if (!fabric) return null;

    // Get stock in all units
    const stockInUnits = fabric.total_stock_meters 
      ? UnitConverter.getAllUnits(parseFloat(fabric.total_stock_meters))
      : null;

    // Get price in requested unit
    const meterRatio = UnitConverter.toMeters(1, displayUnit);
    const pricePerUnit = {
      cost_price: parseFloat((fabric.cost_price_per_meter * meterRatio).toFixed(2)),
      selling_price: parseFloat((fabric.selling_price_per_meter * meterRatio).toFixed(2)),
      wholesale_price: fabric.wholesale_price_per_meter 
        ? parseFloat((fabric.wholesale_price_per_meter * meterRatio).toFixed(2))
        : null,
      unit: displayUnit,
    };

    return {
      ...fabric,
      stock: {
        total_meters: fabric.total_stock_meters ? parseFloat(fabric.total_stock_meters) : 0,
        active_rolls: parseInt(fabric.active_rolls) || 0,
        all_units: stockInUnits,
      },
      pricing: {
        per_meter: {
          cost: parseFloat(fabric.cost_price_per_meter),
          selling: parseFloat(fabric.selling_price_per_meter),
          wholesale: fabric.wholesale_price_per_meter ? parseFloat(fabric.wholesale_price_per_meter) : null,
        },
        [`per_${displayUnit}`]: pricePerUnit,
      },
    };
  }
}

module.exports = FabricModel;