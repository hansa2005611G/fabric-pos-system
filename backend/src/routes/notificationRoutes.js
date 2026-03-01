const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// All routes require authentication
router.use(authenticate);

// Get user notifications
router.get('/', NotificationController.getUserNotifications);

// Get unread count
router.get('/unread-count', NotificationController.getUnreadCount);

// Mark notification as read
router.patch('/:id/read', NotificationController.markAsRead);

// Mark all as read
router.patch('/mark-all-read', NotificationController.markAllAsRead);

// Delete notification
router.delete('/:id', NotificationController.delete);

// Create system notification (admin only)
router.post(
  '/system',
  authorize('admin', 'manager'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').optional().isIn(['info', 'warning', 'error', 'success']).withMessage('Invalid type'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }
    next();
  },
  NotificationController.createSystemNotification
);

// Get branch notifications (admin/manager only)
router.get('/branch', authorize('admin', 'manager'), NotificationController.getBranchNotifications);

module.exports = router;