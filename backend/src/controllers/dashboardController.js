const DashboardModel = require('../models/dashboardModel');

class DashboardController {
  // Get comprehensive dashboard statistics
  static async getDashboardStats(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const stats = await DashboardModel.getDashboardStats(branch_id);

      res.json({
        status: 'success',
        data: { stats },
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch dashboard statistics',
      });
    }
  }

  // Get sales trend
  static async getSalesTrend(req, res) {
    try {
      const { days = 7 } = req.query;
      const branch_id = req.user.branch_id;

      const trend = await DashboardModel.getSalesTrend(branch_id, days);

      res.json({
        status: 'success',
        data: {
          days: parseInt(days),
          trend,
        },
      });
    } catch (error) {
      console.error('Get sales trend error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch sales trend',
      });
    }
  }

  // Get payment method breakdown
  static async getPaymentMethodBreakdown(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const breakdown = await DashboardModel.getPaymentMethodBreakdown(branch_id);

      res.json({
        status: 'success',
        data: { breakdown },
      });
    } catch (error) {
      console.error('Get payment breakdown error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch payment method breakdown',
      });
    }
  }

  // Get hourly sales
  static async getHourlySales(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const hourlySales = await DashboardModel.getHourlySales(branch_id);

      res.json({
        status: 'success',
        data: { hourly_sales: hourlySales },
      });
    } catch (error) {
      console.error('Get hourly sales error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch hourly sales',
      });
    }
  }

  // Get alerts
  static async getAlerts(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const alerts = await DashboardModel.getAlerts(branch_id);

      res.json({
        status: 'success',
        data: {
          alerts,
          count: alerts.length,
        },
      });
    } catch (error) {
      console.error('Get alerts error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch alerts',
      });
    }
  }

  // Get quick stats (lightweight for widgets)
  static async getQuickStats(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const stats = await DashboardModel.getQuickStats(branch_id);

      res.json({
        status: 'success',
        data: { stats },
      });
    } catch (error) {
      console.error('Get quick stats error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch quick statistics',
      });
    }
  }
}

module.exports = DashboardController;