const NotificationModel = require('../models/notificationModel');

class NotificationController {
  // Get user notifications
  static async getUserNotifications(req, res) {
    try {
      const user_id = req.user.user_id;
      const { is_read, type, category, limit } = req.query;

      const notifications = await NotificationModel.getUserNotifications(user_id, {
        is_read: is_read !== undefined ? is_read === 'true' : undefined,
        type,
        category,
        limit: limit ? parseInt(limit) : 50,
      });

      const unreadCount = await NotificationModel.getUnreadCount(user_id);

      res.json({
        status: 'success',
        data: {
          notifications,
          unread_count: unreadCount,
          total: notifications.length,
        },
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch notifications',
      });
    }
  }

  // Get unread count
  static async getUnreadCount(req, res) {
    try {
      const user_id = req.user.user_id;

      const count = await NotificationModel.getUnreadCount(user_id);

      res.json({
        status: 'success',
        data: { unread_count: count },
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch unread count',
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const notification = await NotificationModel.markAsRead(id, user_id);

      if (!notification) {
        return res.status(404).json({
          status: 'error',
          message: 'Notification not found',
        });
      }

      res.json({
        status: 'success',
        message: 'Notification marked as read',
        data: { notification },
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to mark notification as read',
      });
    }
  }

  // Mark all as read
  static async markAllAsRead(req, res) {
    try {
      const user_id = req.user.user_id;

      const count = await NotificationModel.markAllAsRead(user_id);

      res.json({
        status: 'success',
        message: `Marked ${count} notifications as read`,
        data: { updated_count: count },
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to mark all as read',
      });
    }
  }

  // Delete notification
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      const notification = await NotificationModel.delete(id, user_id);

      if (!notification) {
        return res.status(404).json({
          status: 'error',
          message: 'Notification not found',
        });
      }

      res.json({
        status: 'success',
        message: 'Notification deleted',
        data: { notification },
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete notification',
      });
    }
  }

  // Create system notification (admin only)
  static async createSystemNotification(req, res) {
    try {
      const { title, message, type = 'info' } = req.body;
      const branch_id = req.user.branch_id;

      const notification = await NotificationModel.createSystemNotification(
        branch_id,
        title,
        message,
        type
      );

      res.status(201).json({
        status: 'success',
        message: 'System notification created',
        data: { notification },
      });
    } catch (error) {
      console.error('Create system notification error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create notification',
      });
    }
  }

  // Get branch notifications (for admins)
  static async getBranchNotifications(req, res) {
    try {
      const branch_id = req.user.branch_id;
      const { limit = 50 } = req.query;

      const notifications = await NotificationModel.getBranchNotifications(
        branch_id,
        parseInt(limit)
      );

      res.json({
        status: 'success',
        data: {
          notifications,
          total: notifications.length,
        },
      });
    } catch (error) {
      console.error('Get branch notifications error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch branch notifications',
      });
    }
  }
}

module.exports = NotificationController;