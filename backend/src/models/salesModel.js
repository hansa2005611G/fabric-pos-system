const db = require('../config/database');
const FabricRollModel = require('./fabricRollModel');
const AccessoryModel = require('./accessoryModel');
const UnitConverter = require('../utils/unitConverter');

class SalesModel {
  /**
   * Get all sales with filters
   * @param {object} filters - Search filters
   */
  static async getAll(filters = {}) {
    const {
      branch_id,
      status,
      customer_id,
      payment_method,
      date_from,
      date_to,
      search,
    } = filters;

    let query = `
      SELECT 
        s.sale_id,
        s.invoice_number,
        s.branch_id,
        b.branch_name,
        s.customer_id,
        s.customer_name,
        s.customer_phone,
        s.subtotal,
        s.discount_amount,
        s.tax_amount,
        s.total_amount,
        s.payment_method,
        s.paid_amount,
        s.balance_amount,
        s.status,
        s.salesperson_name,
        s.notes,
        s.sale_date,
        s.created_at,
        u.username as created_by,
        u.full_name as created_by_name,
        -- Count items
        COUNT(si.item_id) as item_count
      FROM sales s
      INNER JOIN branches b ON s.branch_id = b.branch_id
      INNER JOIN users u ON s.user_id = u.user_id
      LEFT JOIN sales_items si ON s.sale_id = si.sale_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Filter by branch
    if (branch_id) {
      paramCount++;
      query += ` AND s.branch_id = $${paramCount}`;
      params.push(branch_id);
    }

    // Filter by status
    if (status) {
      paramCount++;
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
    }

    // Filter by customer
    if (customer_id) {
      paramCount++;
      query += ` AND s.customer_id = $${paramCount}`;
      params.push(customer_id);
    }

    // Filter by payment method
    if (payment_method) {
      paramCount++;
      query += ` AND s.payment_method = $${paramCount}`;
      params.push(payment_method);
    }

    // Filter by date range
    if (date_from) {
      paramCount++;
      query += ` AND DATE(s.sale_date) >= $${paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND DATE(s.sale_date) <= $${paramCount}`;
      params.push(date_to);
    }

    // Search by invoice number or customer name
    if (search) {
      paramCount++;
      query += ` AND (
        s.invoice_number ILIKE $${paramCount} OR
        s.customer_name ILIKE $${paramCount} OR
        s.customer_phone ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    query += `
      GROUP BY s.sale_id, b.branch_name, u.username, u.full_name
      ORDER BY s.sale_date DESC, s.created_at DESC
    `;

    const result = await db.query(query, params);
    return result.rows.map(sale => this._formatSale(sale));
  }

  /**
   * Get sale by ID with items
   */
  static async getById(saleId) {
    // Get sale header
    const saleQuery = `
      SELECT 
        s.*,
        b.branch_name,
        b.address as branch_address,
        b.phone as branch_phone,
        u.username as created_by,
        u.full_name as created_by_name,
        c.customer_name as customer_full_name,
        c.phone as customer_full_phone,
        c.address as customer_address,
        c.nic as customer_nic
      FROM sales s
      INNER JOIN branches b ON s.branch_id = b.branch_id
      INNER JOIN users u ON s.user_id = u.user_id
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      WHERE s.sale_id = $1
    `;

    const saleResult = await db.query(saleQuery, [saleId]);

    if (saleResult.rows.length === 0) {
      return null;
    }

    const sale = saleResult.rows[0];

    // Get sale items
    const itemsQuery = `
      SELECT 
        si.item_id,
        si.item_type,
        si.fabric_id,
        si.roll_id,
        si.accessory_id,
        si.item_name,
        si.item_code,
        si.quantity,
        si.unit,
        si.unit_price,
        si.cost_price,
        si.discount_percent,
        si.line_total,
        si.notes,
        -- Calculate profit
        (si.line_total - (si.cost_price * si.quantity)) as line_profit
      FROM sales_items si
      WHERE si.sale_id = $1
      ORDER BY si.item_id ASC
    `;

    const itemsResult = await db.query(itemsQuery, [saleId]);

    return {
      ...this._formatSale(sale),
      items: itemsResult.rows.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        cost_price: parseFloat(item.cost_price),
        discount_percent: parseFloat(item.discount_percent),
        line_total: parseFloat(item.line_total),
        line_profit: parseFloat(item.line_profit),
      })),
    };
  }

  /**
   * Get sale by invoice number
   */
  static async getByInvoiceNumber(invoiceNumber) {
    const result = await db.query(
      'SELECT sale_id FROM sales WHERE invoice_number = $1',
      [invoiceNumber]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.getById(result.rows[0].sale_id);
  }

  /**
   * Create new sale (THE BIG ONE - ATOMIC TRANSACTION)
   * @param {object} saleData - Sale header data
   * @param {array} items - Array of items to sell
   * @param {number} userId - User creating the sale
   */
  static async create(saleData, items, userId) {
    const {
      branch_id,
      customer_id,
      customer_name,
      customer_phone,
      discount_amount = 0,
      tax_amount = 0,
      payment_method,
      paid_amount,
      salesperson_name,
      notes,
    } = saleData;

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Step 1: Generate invoice number
      const invoiceNumber = await this._generateInvoiceNumber(client, branch_id);

      // Step 2: Validate and prepare items
      let subtotal = 0;
      const preparedItems = [];

      for (const item of items) {
        const preparedItem = await this._prepareItem(client, item, branch_id);
        preparedItems.push(preparedItem);
        subtotal += preparedItem.line_total;
      }

      // Step 3: Calculate totals
      const totalAmount = subtotal - parseFloat(discount_amount) + parseFloat(tax_amount);
      const paidAmountFinal = parseFloat(paid_amount) || totalAmount;
      const balanceAmount = totalAmount - paidAmountFinal;

      // Step 4: Determine status
      let status = 'completed';
      if (balanceAmount > 0) {
        status = 'pending'; // Credit sale
      }

      // Step 5: Insert sale header
      const saleQuery = `
        INSERT INTO sales (
          invoice_number, branch_id, customer_id, customer_name, customer_phone,
          subtotal, discount_amount, tax_amount, total_amount,
          payment_method, paid_amount, balance_amount,
          user_id, salesperson_name, status, notes, sale_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING *
      `;

      const saleResult = await client.query(saleQuery, [
        invoiceNumber,
        branch_id,
        customer_id || null,
        customer_name || 'Walk-in Customer',
        customer_phone || null,
        subtotal,
        discount_amount,
        tax_amount,
        totalAmount,
        payment_method,
        paidAmountFinal,
        balanceAmount,
        userId,
        salesperson_name || null,
        status,
        notes || null,
      ]);

      const sale = saleResult.rows[0];

      // Step 6: Insert items and deduct stock
      for (const item of preparedItems) {
        // Insert sale item
        const itemQuery = `
          INSERT INTO sales_items (
            sale_id, item_type, fabric_id, roll_id, accessory_id,
            item_name, item_code, quantity, unit,
            unit_price, cost_price, discount_percent, line_total, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING item_id
        `;

        await client.query(itemQuery, [
          sale.sale_id,
          item.item_type,
          item.fabric_id || null,
          item.roll_id || null,
          item.accessory_id || null,
          item.item_name,
          item.item_code,
          item.quantity,
          item.unit,
          item.unit_price,
          item.cost_price,
          item.discount_percent,
          item.line_total,
          item.notes || null,
        ]);

        // Deduct stock
        if (item.item_type === 'fabric') {
          await this._deductFabricStock(client, item, sale.sale_id, userId);
        } else if (item.item_type === 'accessory') {
          await this._deductAccessoryStock(client, item, sale.sale_id, userId);
        }
      }

      await client.query('COMMIT');
        // Create sale notification
        try {
        const NotificationModel = require('./notificationModel');
        await NotificationModel.createSaleNotification(userId, branch_id, sale);
        } catch (notifError) {
        console.error('Failed to create sale notification:', notifError);
        }

      // Return complete sale with items
      return this.getById(sale.sale_id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update sale status (for completing credit sales, cancellations)
   */
  static async updateStatus(saleId, status, userId) {
    const query = `
      UPDATE sales
      SET status = $1, updated_at = NOW()
      WHERE sale_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [status, saleId]);
    return result.rows[0];
  }

  /**
   * Add payment to credit sale
   */
  static async addPayment(saleId, amount, paymentMethod, userId) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Get current sale
      const saleResult = await client.query(
        'SELECT * FROM sales WHERE sale_id = $1 FOR UPDATE',
        [saleId]
      );

      if (saleResult.rows.length === 0) {
        throw new Error('Sale not found');
      }

      const sale = saleResult.rows[0];

      if (sale.status === 'cancelled') {
        throw new Error('Cannot add payment to cancelled sale');
      }

      const newPaidAmount = parseFloat(sale.paid_amount) + parseFloat(amount);
      const newBalanceAmount = parseFloat(sale.total_amount) - newPaidAmount;

      // Determine new status
      let newStatus = sale.status;
      if (newBalanceAmount <= 0) {
        newStatus = 'completed';
      }

      // Update sale
      const updateResult = await client.query(
        `UPDATE sales
         SET paid_amount = $1, balance_amount = $2, status = $3, updated_at = NOW()
         WHERE sale_id = $4
         RETURNING *`,
        [newPaidAmount, newBalanceAmount, newStatus, saleId]
      );

      // TODO: Log payment transaction in a payments table (Phase 2)

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
   * Generate unique invoice number
   * Format: INV-{BRANCH_ID}-{YYYYMMDD}-{NNNN}
   * @private
   */
  static async _generateInvoiceNumber(client, branchId) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${branchId}-${today}`;

    const result = await client.query(
      `SELECT invoice_number FROM sales
       WHERE invoice_number LIKE $1
       ORDER BY invoice_number DESC
       LIMIT 1`,
      [`${prefix}-%`]
    );

    if (result.rows.length === 0) {
      return `${prefix}-0001`;
    }

    const lastNumber = parseInt(result.rows[0].invoice_number.split('-').pop());
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');

    return `${prefix}-${nextNumber}`;
  }

  /**
   * Prepare and validate item
   * @private
   */
  static async _prepareItem(client, item, branchId) {
    const {
      item_type,
      fabric_id,
      roll_id,
      accessory_id,
      quantity,
      unit = 'meter',
      discount_percent = 0,
      notes,
    } = item;

    if (item_type === 'fabric') {
      // Validate fabric roll
      const rollResult = await client.query(
        `SELECT 
          fr.roll_id, fr.roll_code, fr.remaining_meters, fr.status,
          f.fabric_id, f.fabric_name, f.fabric_code, f.selling_price_per_meter, f.cost_price_per_meter
         FROM fabric_rolls fr
         INNER JOIN fabrics f ON fr.fabric_id = f.fabric_id
         WHERE fr.roll_id = $1 AND fr.branch_id = $2`,
        [roll_id, branchId]
      );

      if (rollResult.rows.length === 0) {
        throw new Error(`Roll ID ${roll_id} not found in this branch`);
      }

      const roll = rollResult.rows[0];

      if (roll.status !== 'active') {
        throw new Error(`Roll ${roll.roll_code} is ${roll.status} and cannot be sold`);
      }

      // Convert quantity to meters
      const metersNeeded = UnitConverter.toMeters(quantity, unit);

      if (parseFloat(roll.remaining_meters) < metersNeeded) {
        throw new Error(
          `Insufficient stock in roll ${roll.roll_code}. Available: ${roll.remaining_meters}m, Requested: ${metersNeeded}m`
        );
      }

      // Calculate prices (convert per-meter price to requested unit)
      const meterRatio = UnitConverter.toMeters(1, unit);
      const unitPrice = parseFloat(roll.selling_price_per_meter) * meterRatio;
      const costPrice = parseFloat(roll.cost_price_per_meter) * meterRatio;

      const lineTotal = unitPrice * quantity * (1 - parseFloat(discount_percent) / 100);

      return {
        item_type: 'fabric',
        fabric_id: roll.fabric_id,
        roll_id: roll.roll_id,
        accessory_id: null,
        item_name: roll.fabric_name,
        item_code: roll.fabric_code,
        quantity,
        unit,
        unit_price: unitPrice,
        cost_price: costPrice,
        discount_percent,
        line_total: lineTotal,
        notes,
        // Extra data for stock deduction
        _meters_to_deduct: metersNeeded,
      };
    } else if (item_type === 'accessory') {
      // Validate accessory
      const accResult = await client.query(
        `SELECT * FROM accessories WHERE accessory_id = $1 AND branch_id = $2`,
        [accessory_id, branchId]
      );

      if (accResult.rows.length === 0) {
        throw new Error(`Accessory ID ${accessory_id} not found in this branch`);
      }

      const accessory = accResult.rows[0];

      if (!accessory.is_active) {
        throw new Error(`Accessory ${accessory.accessory_name} is inactive`);
      }

      if (parseFloat(accessory.current_stock) < parseFloat(quantity)) {
        throw new Error(
          `Insufficient stock for ${accessory.accessory_name}. Available: ${accessory.current_stock}, Requested: ${quantity}`
        );
      }

      const unitPrice = parseFloat(accessory.selling_price);
      const costPrice = parseFloat(accessory.cost_price);
      const lineTotal = unitPrice * quantity * (1 - parseFloat(discount_percent) / 100);

      return {
        item_type: 'accessory',
        fabric_id: null,
        roll_id: null,
        accessory_id: accessory.accessory_id,
        item_name: accessory.accessory_name,
        item_code: accessory.accessory_code,
        quantity,
        unit: accessory.unit,
        unit_price: unitPrice,
        cost_price: costPrice,
        discount_percent,
        line_total: lineTotal,
        notes,
      };
    } else {
      throw new Error(`Invalid item type: ${item_type}`);
    }
  }

  /**
   * Deduct fabric stock from roll
   * @private
   */
  static async _deductFabricStock(client, item, saleId, userId) {
    const metersToDeduct = item._meters_to_deduct;

    // Lock and update roll
    const rollResult = await client.query(
      'SELECT * FROM fabric_rolls WHERE roll_id = $1 FOR UPDATE',
      [item.roll_id]
    );

    const roll = rollResult.rows[0];
    const newRemaining = parseFloat(roll.remaining_meters) - metersToDeduct;

    let newStatus = 'active';
    if (newRemaining === 0 || newRemaining < 0.1) {
      newStatus = 'finished';
    }

    await client.query(
      `UPDATE fabric_rolls
       SET remaining_meters = $1, status = $2, updated_at = NOW()
       WHERE roll_id = $3`,
      [newRemaining, newStatus, item.roll_id]
    );

    // Log transaction
    await client.query(
      `INSERT INTO stock_transactions (
        branch_id, item_type, roll_id, transaction_type,
        quantity, balance_after, reference_type, reference_id, user_id
      )
      VALUES ($1, 'fabric_roll', $2, 'sale', $3, $4, 'sale', $5, $6)`,
      [roll.branch_id, item.roll_id, -metersToDeduct, newRemaining, saleId, userId]
    );
  }

  /**
   * Deduct accessory stock
   * @private
   */
  static async _deductAccessoryStock(client, item, saleId, userId) {
    // Lock and update accessory
    const accResult = await client.query(
      'SELECT * FROM accessories WHERE accessory_id = $1 FOR UPDATE',
      [item.accessory_id]
    );

    const accessory = accResult.rows[0];
    const newStock = parseFloat(accessory.current_stock) - parseFloat(item.quantity);

    await client.query(
      `UPDATE accessories
       SET current_stock = $1, updated_at = NOW()
       WHERE accessory_id = $2`,
      [newStock, item.accessory_id]
    );

    // Log transaction
    await client.query(
      `INSERT INTO stock_transactions (
        branch_id, item_type, accessory_id, transaction_type,
        quantity, balance_after, reference_type, reference_id, user_id
      )
      VALUES ($1, 'accessory', $2, 'sale', $3, $4, 'sale', $5, $6)`,
      [accessory.branch_id, item.accessory_id, -item.quantity, newStock, saleId, userId]
    );
  }

  /**
   * Format sale object
   * @private
   */
  static _formatSale(sale) {
    if (!sale) return null;

    return {
      ...sale,
      subtotal: parseFloat(sale.subtotal),
      discount_amount: parseFloat(sale.discount_amount),
      tax_amount: parseFloat(sale.tax_amount),
      total_amount: parseFloat(sale.total_amount),
      paid_amount: parseFloat(sale.paid_amount),
      balance_amount: parseFloat(sale.balance_amount),
      item_count: parseInt(sale.item_count) || 0,
    };
  }

  /**
   * Get daily sales summary
   */
  static async getDailySummary(branchId, date = null) {
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const query = `
      SELECT 
        COUNT(sale_id) as total_sales,
        SUM(subtotal) as total_subtotal,
        SUM(discount_amount) as total_discount,
        SUM(total_amount) as total_revenue,
        SUM(paid_amount) as total_paid,
        SUM(balance_amount) as total_credit,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sales,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_sales,
        -- Calculate total profit
        (
          SELECT COALESCE(SUM(si.line_total - (si.cost_price * si.quantity)), 0)
          FROM sales_items si
          INNER JOIN sales s2 ON si.sale_id = s2.sale_id
          WHERE s2.branch_id = $1
          AND DATE(s2.sale_date) = $2
        ) as total_profit
      FROM sales
      WHERE branch_id = $1
      AND DATE(sale_date) = $2
      AND status != 'cancelled'
    `;

    const result = await db.query(query, [branchId, targetDate]);
    
    const summary = result.rows[0];
    
    return {
      date: targetDate,
      total_sales: parseInt(summary.total_sales) || 0,
      total_subtotal: parseFloat(summary.total_subtotal) || 0,
      total_discount: parseFloat(summary.total_discount) || 0,
      total_revenue: parseFloat(summary.total_revenue) || 0,
      total_paid: parseFloat(summary.total_paid) || 0,
      total_credit: parseFloat(summary.total_credit) || 0,
      total_profit: parseFloat(summary.total_profit) || 0,
      completed_sales: parseInt(summary.completed_sales) || 0,
      pending_sales: parseInt(summary.pending_sales) || 0,
    };
  }
}

module.exports = SalesModel;