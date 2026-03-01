const db = require('../config/database');
const UnitConverter = require('../utils/unitConverter');

class FabricRollModel {
  /**
   * Get all rolls with filters
   * @param {object} filters - Search filters
   * @param {string} displayUnit - Unit for display
   */
  static async getAll(filters = {}, displayUnit = 'meter') {
    const {
      fabric_id,
      branch_id,
      status,
      search,
      low_stock_only,
      min_meters = 0,
    } = filters;

    let query = `
      SELECT 
        fr.roll_id,
        fr.roll_code,
        fr.fabric_id,
        f.fabric_name,
        f.fabric_code,
        f.color,
        fc.category_name,
        fr.branch_id,
        b.branch_name,
        fr.initial_meters,
        fr.remaining_meters,
        fr.rack_location,
        fr.supplier_name,
        fr.purchase_date,
        fr.purchase_cost_per_meter,
        fr.status,
        fr.created_at,
        fr.updated_at,
        -- Calculate percentage used
        ROUND(((fr.initial_meters - fr.remaining_meters) / fr.initial_meters * 100)::numeric, 2) as used_percentage
      FROM fabric_rolls fr
      INNER JOIN fabrics f ON fr.fabric_id = f.fabric_id
      LEFT JOIN fabric_categories fc ON f.category_id = fc.category_id
      INNER JOIN branches b ON fr.branch_id = b.branch_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Filter by fabric
    if (fabric_id) {
      paramCount++;
      query += ` AND fr.fabric_id = $${paramCount}`;
      params.push(fabric_id);
    }

    // Filter by branch
    if (branch_id) {
      paramCount++;
      query += ` AND fr.branch_id = $${paramCount}`;
      params.push(branch_id);
    }

    // Filter by status
    if (status) {
      paramCount++;
      query += ` AND fr.status = $${paramCount}`;
      params.push(status);
    }

    // Search by roll code, fabric name, or supplier
    if (search) {
      paramCount++;
      query += ` AND (
        fr.roll_code ILIKE $${paramCount} OR
        f.fabric_name ILIKE $${paramCount} OR
        fr.supplier_name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Low stock filter (less than 5 meters or 10% remaining)
    if (low_stock_only) {
      query += ` AND (
        fr.remaining_meters < 5 OR
        (fr.remaining_meters / fr.initial_meters) < 0.1
      )`;
    }

    // Minimum meters filter
    if (min_meters > 0) {
      paramCount++;
      query += ` AND fr.remaining_meters >= $${paramCount}`;
      params.push(min_meters);
    }

    query += ` ORDER BY fr.created_at DESC`;

    const result = await db.query(query, params);

    // Add unit conversions
    return result.rows.map(roll => this._addUnitConversions(roll, displayUnit));
  }

  /**
   * Get roll by ID
   */
  static async getById(rollId, displayUnit = 'meter') {
    const query = `
      SELECT 
        fr.roll_id,
        fr.roll_code,
        fr.fabric_id,
        f.fabric_name,
        f.fabric_code,
        f.color,
        f.brand,
        fc.category_name,
        fr.branch_id,
        b.branch_name,
        fr.initial_meters,
        fr.remaining_meters,
        fr.rack_location,
        fr.supplier_name,
        fr.purchase_date,
        fr.purchase_cost_per_meter,
        fr.status,
        fr.created_at,
        fr.updated_at
      FROM fabric_rolls fr
      INNER JOIN fabrics f ON fr.fabric_id = f.fabric_id
      LEFT JOIN fabric_categories fc ON f.category_id = fc.category_id
      INNER JOIN branches b ON fr.branch_id = b.branch_id
      WHERE fr.roll_id = $1
    `;

    const result = await db.query(query, [rollId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._addUnitConversions(result.rows[0], displayUnit);
  }

  /**
   * Get roll by code
   */
  static async getByCode(rollCode, displayUnit = 'meter') {
    const query = `
      SELECT 
        fr.*,
        f.fabric_name,
        f.fabric_code,
        b.branch_name
      FROM fabric_rolls fr
      INNER JOIN fabrics f ON fr.fabric_id = f.fabric_id
      INNER JOIN branches b ON fr.branch_id = b.branch_id
      WHERE fr.roll_code = $1
    `;

    const result = await db.query(query, [rollCode]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._addUnitConversions(result.rows[0], displayUnit);
  }

  /**
   * Create new roll (purchase entry)
   * @param {object} data - Roll data
   * @param {string} quantityUnit - Unit for meters input
   * @param {number} userId - User creating the roll
   */
  static async create(data, quantityUnit = 'meter', userId) {
    const {
      roll_code,
      fabric_id,
      branch_id,
      initial_quantity,
      rack_location,
      supplier_name,
      purchase_date,
      purchase_cost_per_unit,
      cost_unit = 'meter',
    } = data;

    // Convert quantity to meters
    const initialMeters = UnitConverter.toMeters(initial_quantity, quantityUnit);

    // Convert cost to per-meter
    const meterRatio = UnitConverter.toMeters(1, cost_unit);
    const costPerMeter = purchase_cost_per_unit / meterRatio;

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Insert roll
      const insertQuery = `
        INSERT INTO fabric_rolls (
          roll_code, fabric_id, branch_id, initial_meters, remaining_meters,
          rack_location, supplier_name, purchase_date, purchase_cost_per_meter, status
        )
        VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, 'active')
        RETURNING *
      `;

      const rollResult = await client.query(insertQuery, [
        roll_code,
        fabric_id,
        branch_id,
        initialMeters,
        rack_location || null,
        supplier_name || null,
        purchase_date || new Date(),
        costPerMeter,
      ]);

      const roll = rollResult.rows[0];

      // Log transaction
      await client.query(
        `INSERT INTO stock_transactions (
          branch_id, item_type, roll_id, transaction_type, 
          quantity, balance_after, reference_type, user_id, notes
        )
        VALUES ($1, 'fabric_roll', $2, 'purchase', $3, $4, 'initial_stock', $5, $6)`,
        [
          branch_id,
          roll.roll_id,
          initialMeters,
          initialMeters,
          userId,
          `New roll created: ${roll_code}`,
        ]
      );

      await client.query('COMMIT');

      return roll;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Deduct meters from roll (CRITICAL - used during sales)
   * @param {number} rollId - Roll ID
   * @param {number} quantity - Quantity to deduct
   * @param {string} unit - Unit of quantity
   * @param {number} userId - User making the deduction
   * @param {string} referenceType - 'sale', 'adjustment', etc.
   * @param {number} referenceId - ID of related record (sale_id, etc.)
   * @returns {object} Updated roll
   */
  static async deductMeters(rollId, quantity, unit = 'meter', userId, referenceType, referenceId = null) {
    // Convert to meters
    const metersToDeduct = UnitConverter.toMeters(quantity, unit);

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Lock the row to prevent concurrent modifications
      const lockQuery = `
        SELECT roll_id, remaining_meters, status
        FROM fabric_rolls
        WHERE roll_id = $1
        FOR UPDATE
      `;

      const lockResult = await client.query(lockQuery, [rollId]);

      if (lockResult.rows.length === 0) {
        throw new Error('Roll not found');
      }

      const currentRoll = lockResult.rows[0];

      // Check if roll is active
      if (currentRoll.status !== 'active') {
        throw new Error(`Cannot deduct from ${currentRoll.status} roll`);
      }

      // Check if sufficient stock
      if (parseFloat(currentRoll.remaining_meters) < metersToDeduct) {
        throw new Error(
          `Insufficient stock. Available: ${currentRoll.remaining_meters}m, Requested: ${metersToDeduct}m`
        );
      }

      // Deduct meters
      const newRemaining = parseFloat(currentRoll.remaining_meters) - metersToDeduct;

      // Determine new status
      let newStatus = 'active';
      if (newRemaining === 0) {
        newStatus = 'finished';
      } else if (newRemaining < 0.1) {
        // Less than 10cm
        newStatus = 'finished';
      }

      // Update roll
      const updateQuery = `
        UPDATE fabric_rolls
        SET 
          remaining_meters = $1,
          status = $2,
          updated_at = NOW()
        WHERE roll_id = $3
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        newRemaining,
        newStatus,
        rollId,
      ]);

      const updatedRoll = updateResult.rows[0];

      // Log transaction
      await client.query(
        `INSERT INTO stock_transactions (
          branch_id, item_type, roll_id, transaction_type,
          quantity, balance_after, reference_type, reference_id, user_id
        )
        VALUES ($1, 'fabric_roll', $2, $3, $4, $5, $6, $7, $8)`,
        [
          updatedRoll.branch_id,
          rollId,
          referenceType,
          -metersToDeduct, // Negative for deduction
          newRemaining,
          referenceType,
          referenceId,
          userId,
        ]
      );

      await client.query('COMMIT');

      // Auto-create low stock notification
if (newRemaining < 5 || newRemaining / parseFloat(roll.initial_meters) < 0.1) {
  try {
    const NotificationModel = require('./notificationModel');
    await NotificationModel.createLowStockAlert(roll.branch_id, {
      type: 'fabric_roll',
      id: rollId,
      name: `Roll ${roll.roll_code}`,
      stock: newRemaining,
      unit: 'meter',
    });
  } catch (notifError) {
    console.error('Failed to create low stock notification:', notifError);
    // Don't fail the transaction if notification fails
  }
}

    return updatedRoll;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add meters to roll (return, adjustment)
   * @param {number} rollId - Roll ID
   * @param {number} quantity - Quantity to add
   * @param {string} unit - Unit of quantity
   * @param {number} userId - User making the adjustment
   * @param {string} reason - Reason for addition
   */
  static async addMeters(rollId, quantity, unit = 'meter', userId, reason) {
    const metersToAdd = UnitConverter.toMeters(quantity, unit);

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Lock row
      const lockResult = await client.query(
        'SELECT * FROM fabric_rolls WHERE roll_id = $1 FOR UPDATE',
        [rollId]
      );

      if (lockResult.rows.length === 0) {
        throw new Error('Roll not found');
      }

      const currentRoll = lockResult.rows[0];

      // Calculate new remaining
      const newRemaining = parseFloat(currentRoll.remaining_meters) + metersToAdd;

      // Don't allow adding more than initial
      if (newRemaining > parseFloat(currentRoll.initial_meters)) {
        throw new Error(
          `Cannot add meters beyond initial amount. Initial: ${currentRoll.initial_meters}m, Would be: ${newRemaining}m`
        );
      }

      // Update roll
      const updateResult = await client.query(
        `UPDATE fabric_rolls
         SET remaining_meters = $1, status = 'active', updated_at = NOW()
         WHERE roll_id = $2
         RETURNING *`,
        [newRemaining, rollId]
      );

      // Log transaction
      await client.query(
        `INSERT INTO stock_transactions (
          branch_id, item_type, roll_id, transaction_type,
          quantity, balance_after, reference_type, user_id, notes
        )
        VALUES ($1, 'fabric_roll', $2, 'adjustment', $3, $4, 'manual_add', $5, $6)`,
        [
          currentRoll.branch_id,
          rollId,
          metersToAdd, // Positive for addition
          newRemaining,
          userId,
          reason,
        ]
      );

      await client.query('COMMIT');

      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update roll details (location, supplier, etc.)
   */
  static async update(rollId, data) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'rack_location',
      'supplier_name',
      'purchase_date',
      'purchase_cost_per_meter',
      'status',
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        paramCount++;
        fields.push(`${field} = $${paramCount}`);
        values.push(data[field]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = NOW()');

    paramCount++;
    values.push(rollId);

    const query = `
      UPDATE fabric_rolls
      SET ${fields.join(', ')}
      WHERE roll_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Mark roll as damaged
   */
  static async markAsDamaged(rollId, userId, reason) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const roll = await client.query(
        'SELECT * FROM fabric_rolls WHERE roll_id = $1 FOR UPDATE',
        [rollId]
      );

      if (roll.rows.length === 0) {
        throw new Error('Roll not found');
      }

      const currentRoll = roll.rows[0];

      // Update status
      await client.query(
        `UPDATE fabric_rolls SET status = 'damaged', updated_at = NOW() WHERE roll_id = $1`,
        [rollId]
      );

      // Log transaction
      await client.query(
        `INSERT INTO stock_transactions (
          branch_id, item_type, roll_id, transaction_type,
          quantity, balance_after, reference_type, user_id, notes
        )
        VALUES ($1, 'fabric_roll', $2, 'damage', $3, $4, 'status_change', $5, $6)`,
        [
          currentRoll.branch_id,
          rollId,
          -parseFloat(currentRoll.remaining_meters), // Full remaining as loss
          0,
          userId,
          reason,
        ]
      );

      await client.query('COMMIT');

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if roll code exists
   */
  static async existsByCode(rollCode, excludeId = null) {
    let query = 'SELECT roll_id FROM fabric_rolls WHERE roll_code = $1';
    const params = [rollCode];

    if (excludeId) {
      query += ' AND roll_id != $2';
      params.push(excludeId);
    }

    const result = await db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Generate roll code
   * Format: R-{FABRIC_CODE}-{YYYYMMDD}-{NNN}
   */
  static async generateRollCode(fabricId) {
    // Get fabric code
    const fabricResult = await db.query(
      'SELECT fabric_code FROM fabrics WHERE fabric_id = $1',
      [fabricId]
    );

    if (fabricResult.rows.length === 0) {
      throw new Error('Fabric not found');
    }

    const fabricCode = fabricResult.rows[0].fabric_code;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `R-${fabricCode}-${today}`;

    // Find last roll with this prefix
    const lastRoll = await db.query(
      `SELECT roll_code FROM fabric_rolls
       WHERE roll_code LIKE $1
       ORDER BY roll_code DESC
       LIMIT 1`,
      [`${prefix}-%`]
    );

    if (lastRoll.rows.length === 0) {
      return `${prefix}-001`;
    }

    const lastNumber = parseInt(lastRoll.rows[0].roll_code.split('-').pop());
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');

    return `${prefix}-${nextNumber}`;
  }

  /**
   * Get transaction history for a roll
   */
  static async getTransactionHistory(rollId) {
    const query = `
      SELECT 
        st.transaction_id,
        st.transaction_type,
        st.quantity,
        st.balance_after,
        st.reference_type,
        st.reference_id,
        st.notes,
        st.created_at,
        u.username,
        u.full_name
      FROM stock_transactions st
      LEFT JOIN users u ON st.user_id = u.user_id
      WHERE st.roll_id = $1
      ORDER BY st.created_at DESC
    `;

    const result = await db.query(query, [rollId]);
    return result.rows;
  }

  /**
   * Add unit conversions to roll object
   * @private
   */
  static _addUnitConversions(roll, displayUnit = 'meter') {
    if (!roll) return null;

    const initialInUnits = UnitConverter.getAllUnits(parseFloat(roll.initial_meters));
    const remainingInUnits = UnitConverter.getAllUnits(parseFloat(roll.remaining_meters));
    const usedMeters = parseFloat(roll.initial_meters) - parseFloat(roll.remaining_meters);
    const usedInUnits = UnitConverter.getAllUnits(usedMeters);

    return {
      ...roll,
      quantity: {
        initial: {
          meters: parseFloat(roll.initial_meters),
          all_units: initialInUnits,
        },
        remaining: {
          meters: parseFloat(roll.remaining_meters),
          all_units: remainingInUnits,
        },
        used: {
          meters: usedMeters,
          all_units: usedInUnits,
        },
        percentage_used: roll.used_percentage ? parseFloat(roll.used_percentage) : null,
      },
      display_unit: displayUnit,
    };
  }
}

module.exports = FabricRollModel;