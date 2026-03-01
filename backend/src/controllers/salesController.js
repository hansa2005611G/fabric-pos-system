const SalesModel = require('../models/salesModel');

class SalesController {
  // Get all sales
  static async getAll(req, res) {
    try {
      const {
        status,
        customer_id,
        payment_method,
        date_from,
        date_to,
        search,
      } = req.query;

      const branch_id = req.user.branch_id;

      const sales = await SalesModel.getAll({
        branch_id,
        status,
        customer_id,
        payment_method,
        date_from,
        date_to,
        search,
      });

      res.json({
        status: 'success',
        data: {
          sales,
          count: sales.length,
        },
      });
    } catch (error) {
      console.error('Get sales error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch sales',
      });
    }
  }

  // Get sale by ID (with items)
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const sale = await SalesModel.getById(id);

      if (!sale) {
        return res.status(404).json({
          status: 'error',
          message: 'Sale not found',
        });
      }

      res.json({
        status: 'success',
        data: { sale },
      });
    } catch (error) {
      console.error('Get sale error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch sale',
      });
    }
  }

  // Get sale by invoice number
  static async getByInvoiceNumber(req, res) {
    try {
      const { invoice_number } = req.params;

      const sale = await SalesModel.getByInvoiceNumber(invoice_number);

      if (!sale) {
        return res.status(404).json({
          status: 'error',
          message: 'Sale not found',
        });
      }

      res.json({
        status: 'success',
        data: { sale },
      });
    } catch (error) {
      console.error('Get sale by invoice error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch sale',
      });
    }
  }

  // Create new sale (THE BIG ONE)
  static async create(req, res) {
    try {
      const {
        customer_id,
        customer_name,
        customer_phone,
        items,
        discount_amount = 0,
        tax_amount = 0,
        payment_method,
        paid_amount,
        salesperson_name,
        notes,
      } = req.body;

      const branch_id = req.user.branch_id;
      const user_id = req.user.user_id;

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'At least one item is required',
        });
      }

      // Create sale with atomic transaction
      const sale = await SalesModel.create(
        {
          branch_id,
          customer_id,
          customer_name,
          customer_phone,
          discount_amount,
          tax_amount,
          payment_method,
          paid_amount,
          salesperson_name,
          notes,
        },
        items,
        user_id
      );

      res.status(201).json({
        status: 'success',
        message: 'Sale created successfully',
        data: { sale },
      });
    } catch (error) {
      console.error('Create sale error:', error);

      // Check for specific errors
      if (
        error.message.includes('Insufficient stock') ||
        error.message.includes('not found') ||
        error.message.includes('inactive') ||
        error.message.includes('cannot be sold')
      ) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to create sale',
        details: error.message,
      });
    }
  }

  // Update sale status
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user_id = req.user.user_id;

      // Check if sale exists
      const existing = await SalesModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Sale not found',
        });
      }

      const sale = await SalesModel.updateStatus(id, status, user_id);

      res.json({
        status: 'success',
        message: 'Sale status updated successfully',
        data: { sale },
      });
    } catch (error) {
      console.error('Update sale status error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update sale status',
      });
    }
  }

  // Add payment to credit sale
  static async addPayment(req, res) {
    try {
      const { id } = req.params;
      const { amount, payment_method } = req.body;
      const user_id = req.user.user_id;

      // Check if sale exists
      const existing = await SalesModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Sale not found',
        });
      }

      const sale = await SalesModel.addPayment(id, amount, payment_method, user_id);

      res.json({
        status: 'success',
        message: 'Payment added successfully',
        data: {
          sale,
          payment_added: parseFloat(amount),
          new_balance: parseFloat(sale.balance_amount),
        },
      });
    } catch (error) {
      console.error('Add payment error:', error);

      if (error.message.includes('Cannot add payment')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to add payment',
      });
    }
  }

  // Get daily sales summary
  static async getDailySummary(req, res) {
    try {
      const { date } = req.query;
      const branch_id = req.user.branch_id;

      const summary = await SalesModel.getDailySummary(branch_id, date);

      res.json({
        status: 'success',
        data: { summary },
      });
    } catch (error) {
      console.error('Get daily summary error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch daily summary',
      });
    }
  }

  // Get sales by date range (for reports)
  static async getSalesByDateRange(req, res) {
    try {
      const { date_from, date_to } = req.query;
      const branch_id = req.user.branch_id;

      if (!date_from || !date_to) {
        return res.status(400).json({
          status: 'error',
          message: 'date_from and date_to are required',
        });
      }

      const sales = await SalesModel.getAll({
        branch_id,
        date_from,
        date_to,
      });

      // Calculate summary
      const summary = {
        total_sales: sales.length,
        total_revenue: sales.reduce((sum, s) => sum + s.total_amount, 0),
        total_paid: sales.reduce((sum, s) => sum + s.paid_amount, 0),
        total_credit: sales.reduce((sum, s) => sum + s.balance_amount, 0),
      };

      res.json({
        status: 'success',
        data: {
          date_from,
          date_to,
          sales,
          summary,
        },
      });
    } catch (error) {
      console.error('Get sales by date range error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch sales',
      });
    }
  }
}

module.exports = SalesController;