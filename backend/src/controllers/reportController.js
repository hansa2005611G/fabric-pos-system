const ReportModel = require('../models/reportModel');

class ReportController {
  // Get sales summary report
  static async getSalesSummary(req, res) {
    try {
      const { date_from, date_to } = req.query;
      const branch_id = req.user.branch_id;

      if (!date_from || !date_to) {
        return res.status(400).json({
          status: 'error',
          message: 'date_from and date_to are required',
        });
      }

      const summary = await ReportModel.getSalesSummary(branch_id, date_from, date_to);

      // Calculate totals
      const totals = summary.reduce(
        (acc, day) => ({
          total_sales: acc.total_sales + day.total_sales,
          total_revenue: acc.total_revenue + day.total_revenue,
          total_profit: acc.total_profit + day.total_profit,
        }),
        { total_sales: 0, total_revenue: 0, total_profit: 0 }
      );

      res.json({
        status: 'success',
        data: {
          date_from,
          date_to,
          daily_summary: summary,
          totals,
        },
      });
    } catch (error) {
      console.error('Get sales summary error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch sales summary',
      });
    }
  }

  // Get top selling products
  static async getTopSellingProducts(req, res) {
    try {
      const { date_from, date_to, limit = 10 } = req.query;
      const branch_id = req.user.branch_id;

      if (!date_from || !date_to) {
        return res.status(400).json({
          status: 'error',
          message: 'date_from and date_to are required',
        });
      }

      const [fabrics, accessories] = await Promise.all([
        ReportModel.getTopSellingFabrics(branch_id, date_from, date_to, limit),
        ReportModel.getTopSellingAccessories(branch_id, date_from, date_to, limit),
      ]);

      res.json({
        status: 'success',
        data: {
          date_from,
          date_to,
          top_fabrics: fabrics,
          top_accessories: accessories,
        },
      });
    } catch (error) {
      console.error('Get top selling products error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch top selling products',
      });
    }
  }

  // Get monthly report
  static async getMonthlyReport(req, res) {
    try {
      const { year, month } = req.query;
      const branch_id = req.user.branch_id;

      if (!year || !month) {
        return res.status(400).json({
          status: 'error',
          message: 'year and month are required',
        });
      }

      const report = await ReportModel.getMonthlySalesReport(branch_id, year, month);

      res.json({
        status: 'success',
        data: { report },
      });
    } catch (error) {
      console.error('Get monthly report error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch monthly report',
      });
    }
  }

  // Get yearly report
  static async getYearlyReport(req, res) {
    try {
      const { year } = req.query;
      const branch_id = req.user.branch_id;

      if (!year) {
        return res.status(400).json({
          status: 'error',
          message: 'year is required',
        });
      }

      const report = await ReportModel.getYearlySalesReport(branch_id, year);

      res.json({
        status: 'success',
        data: { report },
      });
    } catch (error) {
      console.error('Get yearly report error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch yearly report',
      });
    }
  }

  // Get profit analysis
  static async getProfitAnalysis(req, res) {
    try {
      const { date_from, date_to } = req.query;
      const branch_id = req.user.branch_id;

      if (!date_from || !date_to) {
        return res.status(400).json({
          status: 'error',
          message: 'date_from and date_to are required',
        });
      }

      const analysis = await ReportModel.getProfitAnalysis(branch_id, date_from, date_to);

      res.json({
        status: 'success',
        data: { analysis },
      });
    } catch (error) {
      console.error('Get profit analysis error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch profit analysis',
      });
    }
  }

  // Get low stock report
  static async getLowStockReport(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const report = await ReportModel.getLowStockReport(branch_id);

      res.json({
        status: 'success',
        data: { report },
      });
    } catch (error) {
      console.error('Get low stock report error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch low stock report',
      });
    }
  }

  // Get top customers
  static async getTopCustomers(req, res) {
    try {
      const { date_from, date_to, limit = 10 } = req.query;
      const branch_id = req.user.branch_id;

      if (!date_from || !date_to) {
        return res.status(400).json({
          status: 'error',
          message: 'date_from and date_to are required',
        });
      }

      const customers = await ReportModel.getTopCustomers(branch_id, date_from, date_to, limit);

      res.json({
        status: 'success',
        data: {
          date_from,
          date_to,
          customers,
          count: customers.length,
        },
      });
    } catch (error) {
      console.error('Get top customers error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch top customers',
      });
    }
  }

  // Get stock value report
  static async getStockValueReport(req, res) {
    try {
      const branch_id = req.user.branch_id;

      const report = await ReportModel.getStockValueReport(branch_id);

      res.json({
        status: 'success',
        data: { report },
      });
    } catch (error) {
      console.error('Get stock value report error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch stock value report',
      });
    }
  }
}

module.exports = ReportController;