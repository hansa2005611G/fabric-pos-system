const db = require('../config/database');

class AccessoryModel {
  /**
   * Get all accessories with filters
   * @param {object} filters - Search filters
   */
  static async getAll(filters = {}) {
    const { category_id, search, is_active, low_stock_only, branch_id } = filters;

    let query = `
      SELECT 
        a.accessory_id,
        a.accessory_code,
        a.accessory_name,
        a.category_id,
        ac.category_name,
        a.unit,
        a.pieces_per_pack,
        a.cost_price,
        a.selling_price,
        a.branch_id,
        b.branch_name,
        a.current_stock,
        a.min_stock_level,
        a.description,
        a.is_active,
        a.created_at,
        a.updated_at,
        -- Calculate stock status
        CASE 
          WHEN a.current_stock = 0 THEN 'out_of_stock'
          WHEN a.current_stock <= a.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM accessories a
      LEFT JOIN accessory_categories ac ON a.category_id = ac.category_id
      INNER JOIN branches b ON a.branch_id = b.branch_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Filter by category
    if (category_id) {
      paramCount++;
      query += ` AND a.category_id = $${paramCount}`;
      params.push(category_id);
    }

    // Filter by branch
    if (branch_id) {
      paramCount++;
      query += ` AND a.branch_id = $${paramCount}`;
      params.push(branch_id);
    }

    // Filter by active status
    if (is_active !== undefined) {
      paramCount++;
      query += ` AND a.is_active = $${paramCount}`;
      params.push(is_active);
    }

    // Search by name or code
    if (search) {
      paramCount++;
      query += ` AND (
        a.accessory_name ILIKE $${paramCount} OR
        a.accessory_code ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Low stock filter
    if (low_stock_only) {
      query += ` AND a.current_stock <= a.min_stock_level`;
    }

    query += ` ORDER BY a.accessory_name ASC`;

    const result = await db.query(query, params);
    return result.rows.map(acc => this._formatAccessory(acc));
  }

  /**
   * Get accessory by ID
   */
  static async getById(accessoryId) {
    const query = `
      SELECT 
        a.*,
        ac.category_name,
        b.branch_name,
        CASE 
          WHEN a.current_stock = 0 THEN 'out_of_stock'
          WHEN a.current_stock <= a.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM accessories a
      LEFT JOIN accessory_categories ac ON a.category_id = ac.category_id
      INNER JOIN branches b ON a.branch_id = b.branch_id
      WHERE a.accessory_id = $1
    `;

    const result = await db.query(query, [accessoryId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._formatAccessory(result.rows[0]);
  }

  /**
   * Get accessory by code
   */
  static async getByCode(accessoryCode) {
    const query = `
      SELECT 
        a.*,
        ac.category_name,
        b.branch_name
      FROM accessories a
      LEFT JOIN accessory_categories ac ON a.category_id = ac.category_id
      INNER JOIN branches b ON a.branch_id = b.branch_id
      WHERE a.accessory_code = $1
    `;

    const result = await db.query(query, [accessoryCode]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._formatAccessory(result.rows[0]);
  }

  /**
   * Create new accessory
   */
  static async create(data, branchId) {
    const {
      accessory_code,
      accessory_name,
      category_id,
      unit,
      pieces_per_pack = 1,
      cost_price,
      selling_price,
      current_stock = 0,
      min_stock_level = 0,
      description,
    } = data;

    const query = `
      INSERT INTO accessories (
        accessory_code, accessory_name, category_id, unit, pieces_per_pack,
        cost_price, selling_price, branch_id, current_stock, min_stock_level, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await db.query(query, [
      accessory_code,
      accessory_name,
      category_id,
      unit,
      pieces_per_pack,
      cost_price,
      selling_price,
      branchId,
      current_stock,
      min_stock_level,
      description || null,
    ]);

    return result.rows[0];
  }

  /**
   * Update accessory
   */
  static async update(accessoryId, data) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'accessory_name',
      'category_id',
      'unit',
      'pieces_per_pack',
      'cost_price',
      'selling_price',
      'min_stock_level',
      'description',
      'is_active',
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
    values.push(accessoryId);

    const query = `
      UPDATE accessories
      SET ${fields.join(', ')}
      WHERE accessory_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Add stock (purchase, adjustment)
   * @param {number} accessoryId
   * @param {number} quantity
   * @param {number} userId
   * @param {string} referenceType - 'purchase', 'adjustment', 'return'
   * @param {number} referenceId
   */
  static async addStock(accessoryId, quantity, userId, referenceType, referenceId = null) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Lock row
      const lockResult = await client.query(
        'SELECT * FROM accessories WHERE accessory_id = $1 FOR UPDATE',
        [accessoryId]
      );

      if (lockResult.rows.length === 0) {
        throw new Error('Accessory not found');
      }

      const accessory = lockResult.rows[0];
      const newStock = parseFloat(accessory.current_stock) + parseFloat(quantity);

      // Update stock
      const updateResult = await client.query(
        `UPDATE accessories
         SET current_stock = $1, updated_at = NOW()
         WHERE accessory_id = $2
         RETURNING *`,
        [newStock, accessoryId]
      );

      // Log transaction
      await client.query(
        `INSERT INTO stock_transactions (
          branch_id, item_type, accessory_id, transaction_type,
          quantity, balance_after, reference_type, reference_id, user_id
        )
        VALUES ($1, 'accessory', $2, $3, $4, $5, $6, $7, $8)`,
        [
          accessory.branch_id,
          accessoryId,
          referenceType,
          quantity, // Positive for addition
          newStock,
          referenceType,
          referenceId,
          userId,
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
   * Deduct stock (sale, adjustment)
   * @param {number} accessoryId
   * @param {number} quantity
   * @param {number} userId
   * @param {string} referenceType - 'sale', 'adjustment', 'damage'
   * @param {number} referenceId
   */
  static async deductStock(accessoryId, quantity, userId, referenceType, referenceId = null) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Lock row
      const lockResult = await client.query(
        'SELECT * FROM accessories WHERE accessory_id = $1 FOR UPDATE',
        [accessoryId]
      );

      if (lockResult.rows.length === 0) {
        throw new Error('Accessory not found');
      }

      const accessory = lockResult.rows[0];

      // Check if active
      if (!accessory.is_active) {
        throw new Error('Cannot deduct from inactive accessory');
      }

      // Check sufficient stock
      if (parseFloat(accessory.current_stock) < parseFloat(quantity)) {
        throw new Error(
          `Insufficient stock. Available: ${accessory.current_stock} ${accessory.unit}, Requested: ${quantity} ${accessory.unit}`
        );
      }

      const newStock = parseFloat(accessory.current_stock) - parseFloat(quantity);

      // Update stock
      const updateResult = await client.query(
        `UPDATE accessories
         SET current_stock = $1, updated_at = NOW()
         WHERE accessory_id = $2
         RETURNING *`,
        [newStock, accessoryId]
      );

      // Log transaction
      await client.query(
        `INSERT INTO stock_transactions (
          branch_id, item_type, accessory_id, transaction_type,
          quantity, balance_after, reference_type, reference_id, user_id
        )
        VALUES ($1, 'accessory', $2, $3, $4, $5, $6, $7, $8)`,
        [
          accessory.branch_id,
          accessoryId,
          referenceType,
          -quantity, // Negative for deduction
          newStock,
          referenceType,
          referenceId,
          userId,
        ]
      );

      await client.query('COMMIT');

      
         // Auto-create low stock notification
        if (newStock <= parseFloat(accessory.min_stock_level)) {
            try {
                const NotificationModel = require('./notificationModel');
                await NotificationModel.createLowStockAlert(accessory.branch_id, {
                type: 'accessory',
                id: accessoryId,
                name: accessory.accessory_name,
                stock: newStock,
                unit: accessory.unit,
                });
            } catch (notifError) {
                console.error('Failed to create low stock notification:', notifError);
            }
            }

      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete accessory (soft delete)
   */
  static async delete(accessoryId) {
    // Check if has stock
    const stockCheck = await db.query(
      'SELECT current_stock FROM accessories WHERE accessory_id = $1',
      [accessoryId]
    );

    if (stockCheck.rows.length === 0) {
      throw new Error('Accessory not found');
    }

    if (parseFloat(stockCheck.rows[0].current_stock) > 0) {
      throw new Error('Cannot delete accessory with remaining stock. Please adjust stock to zero first.');
    }

    const query = `
      UPDATE accessories
      SET is_active = false, updated_at = NOW()
      WHERE accessory_id = $1
      RETURNING accessory_id, accessory_code, accessory_name
    `;

    const result = await db.query(query, [accessoryId]);
    return result.rows[0];
  }

  /**
   * Check if code exists
   */
  static async existsByCode(accessoryCode, excludeId = null) {
    let query = 'SELECT accessory_id FROM accessories WHERE accessory_code = $1';
    const params = [accessoryCode];

    if (excludeId) {
      query += ' AND accessory_id != $2';
      params.push(excludeId);
    }

    const result = await db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Generate accessory code
   * Format: ACC-{CATEGORY}-{YYYYMMDD}-{NNN}
   */
  static async generateAccessoryCode(categoryId = null) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let prefix = 'ACC';

    if (categoryId) {
      const catResult = await db.query(
        'SELECT category_name FROM accessory_categories WHERE category_id = $1',
        [categoryId]
      );

      if (catResult.rows.length > 0) {
        // Get first 3 letters of category name
        const catCode = catResult.rows[0].category_name
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Z]/g, '');
        prefix = `ACC-${catCode}`;
      }
    }

    prefix = `${prefix}-${today}`;

    // Find last code with this prefix
    const lastCode = await db.query(
      `SELECT accessory_code FROM accessories
       WHERE accessory_code LIKE $1
       ORDER BY accessory_code DESC
       LIMIT 1`,
      [`${prefix}-%`]
    );

    if (lastCode.rows.length === 0) {
      return `${prefix}-001`;
    }

    const lastNumber = parseInt(lastCode.rows[0].accessory_code.split('-').pop());
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');

    return `${prefix}-${nextNumber}`;
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(accessoryId) {
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
      WHERE st.accessory_id = $1
      ORDER BY st.created_at DESC
    `;

    const result = await db.query(query, [accessoryId]);
    return result.rows;
  }

  /**
   * Get low stock accessories
   */
  static async getLowStock(branchId = null) {
    let query = `
      SELECT 
        a.*,
        ac.category_name,
        b.branch_name
      FROM accessories a
      LEFT JOIN accessory_categories ac ON a.category_id = ac.category_id
      INNER JOIN branches b ON a.branch_id = b.branch_id
      WHERE a.is_active = true
      AND a.current_stock <= a.min_stock_level
    `;

    const params = [];

    if (branchId) {
      query += ' AND a.branch_id = $1';
      params.push(branchId);
    }

    query += ' ORDER BY a.current_stock ASC';

    const result = await db.query(query, params);
    return result.rows.map(acc => this._formatAccessory(acc));
  }

  /**
   * Format accessory object
   * @private
   */
  static _formatAccessory(accessory) {
    if (!accessory) return null;

    return {
      ...accessory,
      current_stock: parseFloat(accessory.current_stock),
      min_stock_level: parseFloat(accessory.min_stock_level),
      cost_price: parseFloat(accessory.cost_price),
      selling_price: parseFloat(accessory.selling_price),
      pieces_per_pack: parseInt(accessory.pieces_per_pack) || 1,
      stock_info: {
        status: accessory.stock_status,
        available: parseFloat(accessory.current_stock),
        min_level: parseFloat(accessory.min_stock_level),
        unit: accessory.unit,
      },
    };
  }
}

module.exports = AccessoryModel;