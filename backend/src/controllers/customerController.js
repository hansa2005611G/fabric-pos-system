const CustomerModel = require('../models/customerModel');

class CustomerController {
  // Get all customers
  static async getAll(req, res) {
    try {
      const { search, has_credit, sort_by, sort_order } = req.query;

      const customers = await CustomerModel.getAll({
        search,
        has_credit,
        sort_by,
        sort_order,
      });

      res.json({
        status: 'success',
        data: {
          customers,
          count: customers.length,
        },
      });
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch customers',
      });
    }
  }

  // Get customer by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const customer = await CustomerModel.getById(id);

      if (!customer) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found',
        });
      }

      res.json({
        status: 'success',
        data: { customer },
      });
    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch customer',
      });
    }
  }

  // Create customer
  static async create(req, res) {
    try {
      const { customer_name, phone, address, nic, email, notes } = req.body;

      // Check if phone exists
      if (phone) {
        const phoneExists = await CustomerModel.existsByPhone(phone);
        if (phoneExists) {
          return res.status(400).json({
            status: 'error',
            message: 'Customer with this phone number already exists',
          });
        }
      }

      const customer = await CustomerModel.create({
        customer_name,
        phone,
        address,
        nic,
        email,
        notes,
      });

      res.status(201).json({
        status: 'success',
        message: 'Customer created successfully',
        data: { customer },
      });
    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create customer',
      });
    }
  }

  // Update customer
  static async update(req, res) {
    try {
      const { id } = req.params;

      // Check if exists
      const existing = await CustomerModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found',
        });
      }

      // Check if new phone conflicts
      if (req.body.phone) {
        const phoneExists = await CustomerModel.existsByPhone(req.body.phone, id);
        if (phoneExists) {
          return res.status(400).json({
            status: 'error',
            message: 'Phone number already in use by another customer',
          });
        }
      }

      const customer = await CustomerModel.update(id, req.body);

      res.json({
        status: 'success',
        message: 'Customer updated successfully',
        data: { customer },
      });
    } catch (error) {
      console.error('Update customer error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update customer',
      });
    }
  }

  // Delete customer
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const existing = await CustomerModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found',
        });
      }

      const customer = await CustomerModel.delete(id);

      res.json({
        status: 'success',
        message: 'Customer deleted successfully',
        data: { customer },
      });
    } catch (error) {
      console.error('Delete customer error:', error);

      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to delete customer',
      });
    }
  }

  // Get purchase history
  static async getPurchaseHistory(req, res) {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.query;

      const existing = await CustomerModel.getById(id);
      if (!existing) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found',
        });
      }

      const purchases = await CustomerModel.getPurchaseHistory(id, limit);

      res.json({
        status: 'success',
        data: {
          customer_id: id,
          customer_name: existing.customer_name,
          purchases,
          count: purchases.length,
        },
      });
    } catch (error) {
      console.error('Get purchase history error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch purchase history',
      });
    }
  }

  // Get customers with credit
  static async getCustomersWithCredit(req, res) {
    try {
      const customers = await CustomerModel.getCustomersWithCredit();

      res.json({
        status: 'success',
        data: {
          customers,
          count: customers.length,
          total_outstanding: customers.reduce((sum, c) => sum + c.total_outstanding, 0),
        },
      });
    } catch (error) {
      console.error('Get customers with credit error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch customers with credit',
      });
    }
  }

  // Quick search (for POS autocomplete)
  static async quickSearch(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.json({
          status: 'success',
          data: { customers: [] },
        });
      }

      const customers = await CustomerModel.getAll({ search: q });

      // Return simplified data for autocomplete
      const simplified = customers.slice(0, 10).map(c => ({
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        phone: c.phone,
        outstanding_balance: c.outstanding_balance,
      }));

      res.json({
        status: 'success',
        data: { customers: simplified },
      });
    } catch (error) {
      console.error('Quick search error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Search failed',
      });
    }
  }
}

module.exports = CustomerController;