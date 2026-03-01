const db = require('../config/database');

class NotificationModel {
  /**
   * Create notification
   */
  static async create(data) {
    const {
      user_id,
      branch_id,
      title,
      message,
      type,
      category,
      action_url,
      reference_type,
      reference_id,
    } = data;

    const query = `
      INSERT INTO notifications (
        user_id, branch_id, title, message, type, category,
        action_url, reference_type, reference_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await db.query(query, [
      user_id || null,
      branch_id || null,
      title,
      message,
      type,
      category,
      action_url || null,
      reference_type || null,
      reference_id || null,
    ]);

    return result.rows[0];
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId, filters = {}) {
    const { is_read, type, category, limit = 50 } = filters;

    let query = `
      SELECT *
      FROM notifications
      WHERE user_id = $1 OR user_id IS NULL
    `;

    const params = [userId];
    let paramCount = 1;

    if (is_read !== undefined) {
      paramCount++;
      query += ` AND is_read = $${paramCount}`;
      params.push(is_read);
    }

    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get branch notifications
   */
  static async getBranchNotifications(branchId, limit = 50) {
    const query = `
      SELECT *
      FROM notifications
      WHERE branch_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [branchId, limit]);
    return result.rows;
  }

  /**
   * Mark as read
   */
  static async markAsRead(notificationId, userId) {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE notification_id = $1
      AND (user_id = $2 OR user_id IS NULL)
      RETURNING *
    `;

    const result = await db.query(query, [notificationId, userId]);
    return result.rows[0];
  }

  /**
   * Mark all as read for user
   */
  static async markAllAsRead(userId) {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
      RETURNING COUNT(*) as updated_count
    `;

    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].updated_count);
  }

  /**
   * Delete notification
   */
  static async delete(notificationId, userId) {
    const query = `
      DELETE FROM notifications
      WHERE notification_id = $1
      AND (user_id = $2 OR user_id IS NULL)
      RETURNING *
    `;

    const result = await db.query(query, [notificationId, userId]);
    return result.rows[0];
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId) {
    const query = `
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE (user_id = $1 OR user_id IS NULL)
      AND is_read = false
    `;

    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].unread_count);
  }

  /**
   * Create system notification (broadcast to all users in branch)
   */
  static async createSystemNotification(branchId, title, message, type = 'info') {
    return await this.create({
      branch_id: branchId,
      title,
      message,
      type,
      category: 'system',
    });
  }

  /**
   * Create low stock alert
   */
  static async createLowStockAlert(branchId, item) {
    return await this.create({
      branch_id: branchId,
      title: 'Low Stock Alert',
      message: `${item.name} is running low on stock. Current: ${item.stock} ${item.unit}`,
      type: 'warning',
      category: 'inventory',
      action_url: item.type === 'fabric' ? `/fabric-rolls/${item.id}` : `/accessories/${item.id}`,
      reference_type: item.type,
      reference_id: item.id,
    });
  }

  /**
   * Create sale notification
   */
  static async createSaleNotification(userId, branchId, saleData) {
    return await this.create({
      user_id: userId,
      branch_id: branchId,
      title: 'Sale Completed',
      message: `Invoice ${saleData.invoice_number} created for Rs. ${saleData.total_amount.toFixed(2)}`,
      type: 'success',
      category: 'sales',
      action_url: `/sales/${saleData.sale_id}`,
      reference_type: 'sale',
      reference_id: saleData.sale_id,
    });
  }
}

module.exports = NotificationModel;