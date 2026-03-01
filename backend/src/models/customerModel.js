const db = require('../config/database');

class CustomerModel {
  /**
   * Get all customers with filters
   */
  static async getAll(filters = {}) {
    const { search, has_credit, sort_by = 'created_at', sort_order = 'DESC' } = filters;

    let query = `
      SELECT 
        c.customer_id,
        c.customer_name,
        c.phone,
        c.address,
        c.nic,
        c.email,
        c.notes,
        c.created_at,
        -- Calculate total purchases
        COUNT(DISTINCT s.sale_id) as total_purchases,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        COALESCE(SUM(s.balance_amount), 0) as outstanding_balance,
        -- Last purchase date
        MAX(s.sale_date) as last_purchase_date
      FROM customers c
      LEFT JOIN sales s ON c.customer_id = s.customer_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Search by name, phone, NIC
    if (search) {
      paramCount++;
      query += ` AND (
        c.customer_name ILIKE $${paramCount} OR
        c.phone ILIKE $${paramCount} OR
        c.nic ILIKE $${paramCount} OR
        c.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY c.customer_id`;

    // Filter by credit balance
    if (has_credit === 'true') {
      query += ` HAVING COALESCE(SUM(s.balance_amount), 0) > 0`;
    }

    // Sort
    const allowedSortFields = ['customer_name', 'created_at', 'total_spent', 'outstanding_balance'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortField} ${sortDir}`;

    const result = await db.query(query, params);
    return result.rows.map(customer => this._formatCustomer(customer));
  }

  /**
   * Get customer by ID
   */
  static async getById(customerId) {
    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT s.sale_id) as total_purchases,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        COALESCE(SUM(s.balance_amount), 0) as outstanding_balance,
        MAX(s.sale_date) as last_purchase_date
      FROM customers c
      LEFT JOIN sales s ON c.customer_id = s.customer_id
      WHERE c.customer_id = $1
      GROUP BY c.customer_id
    `;

    const result = await db.query(query, [customerId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._formatCustomer(result.rows[0]);
  }

  /**
   * Get customer by phone
   */
  static async getByPhone(phone) {
    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT s.sale_id) as total_purchases,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        COALESCE(SUM(s.balance_amount), 0) as outstanding_balance
      FROM customers c
      LEFT JOIN sales s ON c.customer_id = s.customer_id
      WHERE c.phone = $1
      GROUP BY c.customer_id
    `;

    const result = await db.query(query, [phone]);

    if (result.rows.length === 0) {
      return null;
    }

    return this._formatCustomer(result.rows[0]);
  }

  /**
   * Create customer
   */
  static async create(data) {
    const { customer_name, phone, address, nic, email, notes } = data;

    const query = `
      INSERT INTO customers (customer_name, phone, address, nic, email, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      customer_name,
      phone || null,
      address || null,
      nic || null,
      email || null,
      notes || null,
    ]);

    return result.rows[0];
  }

  /**
   * Update customer
   */
  static async update(customerId, data) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['customer_name', 'phone', 'address', 'nic', 'email', 'notes'];

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

    paramCount++;
    values.push(customerId);

    const query = `
      UPDATE customers
      SET ${fields.join(', ')}
      WHERE customer_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete customer
   */
  static async delete(customerId) {
    // Check if has sales
    const salesCheck = await db.query(
      'SELECT COUNT(*) as count FROM sales WHERE customer_id = $1',
      [customerId]
    );

    if (parseInt(salesCheck.rows[0].count) > 0) {
      throw new Error('Cannot delete customer with existing sales records');
    }

    const query = `
      DELETE FROM customers
      WHERE customer_id = $1
      RETURNING customer_id, customer_name
    `;

    const result = await db.query(query, [customerId]);
    return result.rows[0];
  }

  /**
   * Get customer purchase history
   */
  static async getPurchaseHistory(customerId, limit = 50) {
    const query = `
      SELECT 
        s.sale_id,
        s.invoice_number,
        s.sale_date,
        s.total_amount,
        s.paid_amount,
        s.balance_amount,
        s.payment_method,
        s.status,
        COUNT(si.item_id) as item_count
      FROM sales s
      LEFT JOIN sales_items si ON s.sale_id = si.sale_id
      WHERE s.customer_id = $1
      GROUP BY s.sale_id
      ORDER BY s.sale_date DESC
      LIMIT $2
    `;

    const result = await db.query(query, [customerId, limit]);
    return result.rows.map(sale => ({
      ...sale,
      total_amount: parseFloat(sale.total_amount),
      paid_amount: parseFloat(sale.paid_amount),
      balance_amount: parseFloat(sale.balance_amount),
      item_count: parseInt(sale.item_count),
    }));
  }

  /**
   * Get customers with outstanding credit
   */
  static async getCustomersWithCredit() {
    const query = `
      SELECT 
        c.customer_id,
        c.customer_name,
        c.phone,
        SUM(s.balance_amount) as total_outstanding
      FROM customers c
      INNER JOIN sales s ON c.customer_id = s.customer_id
      WHERE s.balance_amount > 0
      AND s.status = 'pending'
      GROUP BY c.customer_id
      HAVING SUM(s.balance_amount) > 0
      ORDER BY total_outstanding DESC
    `;

    const result = await db.query(query);
    return result.rows.map(customer => ({
      ...customer,
      total_outstanding: parseFloat(customer.total_outstanding),
    }));
  }

  /**
   * Check if phone exists
   */
  static async existsByPhone(phone, excludeId = null) {
    let query = 'SELECT customer_id FROM customers WHERE phone = $1';
    const params = [phone];

    if (excludeId) {
      query += ' AND customer_id != $2';
      params.push(excludeId);
    }

    const result = await db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Format customer object
   * @private
   */
  static _formatCustomer(customer) {
    if (!customer) return null;

    return {
      ...customer,
      total_purchases: parseInt(customer.total_purchases) || 0,
      total_spent: parseFloat(customer.total_spent) || 0,
      outstanding_balance: parseFloat(customer.outstanding_balance) || 0,
    };
  }
}

module.exports = CustomerModel;