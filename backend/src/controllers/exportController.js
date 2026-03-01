const ExportHelper = require('../utils/exportHelper');
const ReportModel = require('../models/reportModel');
const SalesModel = require('../models/salesModel');
const db = require('../config/database');

class ExportController {
  // Export sales report to PDF
  static async exportSalesPDF(req, res) {
    try {
      const { date_from, date_to } = req.query;
      const branch_id = req.user.branch_id;

      if (!date_from || !date_to) {
        return res.status(400).json({
          status: 'error',
          message: 'date_from and date_to are required',
        });
      }

      // Get sales data
      const salesData = await ReportModel.getSalesSummary(branch_id, date_from, date_to);

      // Calculate summary
      const summary = {
        date_from,
        date_to,
        total_sales: salesData.reduce((sum, row) => sum + row.total_sales, 0),
        total_revenue: salesData.reduce((sum, row) => sum + row.total_revenue, 0),
        total_profit: salesData.reduce((sum, row) => sum + row.total_profit, 0),
      };

      // Generate filename
      const filename = `sales-report-${date_from}-to-${date_to}`;

      // Export to PDF
      const filepath = await ExportHelper.exportSalesPDF(salesData, summary, filename);

      res.json({
        status: 'success',
        message: 'Sales report exported to PDF',
        data: {
          download_url: filepath,
          filename: `${filename}.pdf`,
        },
      });
    } catch (error) {
      console.error('Export sales PDF error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to export sales report',
      });
    }
  }

  // Export sales report to Excel
  static async exportSalesExcel(req, res) {
    try {
      const { date_from, date_to } = req.query;
      const branch_id = req.user.branch_id;

      if (!date_from || !date_to) {
        return res.status(400).json({
          status: 'error',
          message: 'date_from and date_to are required',
        });
      }

      const salesData = await ReportModel.getSalesSummary(branch_id, date_from, date_to);

      const summary = {
        date_from,
        date_to,
        total_sales: salesData.reduce((sum, row) => sum + row.total_sales, 0),
        total_revenue: salesData.reduce((sum, row) => sum + row.total_revenue, 0),
        total_profit: salesData.reduce((sum, row) => sum + row.total_profit, 0),
      };

      const filename = `sales-report-${date_from}-to-${date_to}`;
      const filepath = await ExportHelper.exportSalesExcel(salesData, summary, filename);

      res.json({
        status: 'success',
        message: 'Sales report exported to Excel',
        data: {
          download_url: filepath,
          filename: `${filename}.xlsx`,
        },
      });
    } catch (error) {
      console.error('Export sales Excel error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to export sales report',
      });
    }
  }

  // Export invoice to PDF
  static async exportInvoicePDF(req, res) {
    try {
      const { invoice_number } = req.params;

      // Get invoice data with items
      const sale = await SalesModel.getByInvoiceNumber(invoice_number);

      if (!sale) {
        return res.status(404).json({
          status: 'error',
          message: 'Invoice not found',
        });
      }

      const filename = `invoice-${invoice_number}`;
      const filepath = await ExportHelper.exportInvoicePDF(sale, filename);

      res.json({
        status: 'success',
        message: 'Invoice exported to PDF',
        data: {
          download_url: filepath,
          filename: `${filename}.pdf`,
        },
      });
    } catch (error) {
      console.error('Export invoice PDF error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to export invoice',
      });
    }
  }

  // Export stock report to Excel
  static async exportStockExcel(req, res) {
    try {
      const branch_id = req.user.branch_id;

      // Get rolls
      const rollsQuery = `
        SELECT 
          fr.roll_code,
          f.fabric_name,
          fr.initial_meters,
          fr.remaining_meters,
          fr.status,
          fr.rack_location
        FROM fabric_rolls fr
        INNER JOIN fabrics f ON fr.fabric_id = f.fabric_id
        WHERE fr.branch_id = $1
        ORDER BY f.fabric_name, fr.roll_code
      `;

      // Get accessories
      const accessoriesQuery = `
        SELECT 
          a.accessory_code,
          a.accessory_name,
          a.current_stock,
          a.min_stock_level,
          a.unit
        FROM accessories a
        WHERE a.branch_id = $1
        AND a.is_active = true
        ORDER BY a.accessory_name
      `;

      const [rollsResult, accessoriesResult] = await Promise.all([
        db.query(rollsQuery, [branch_id]),
        db.query(accessoriesQuery, [branch_id]),
      ]);

      const stockData = {
        rolls: rollsResult.rows.map(row => ({
          ...row,
          initial_meters: parseFloat(row.initial_meters),
          remaining_meters: parseFloat(row.remaining_meters),
        })),
        accessories: accessoriesResult.rows.map(row => ({
          ...row,
          current_stock: parseFloat(row.current_stock),
          min_stock_level: parseFloat(row.min_stock_level),
        })),
      };

      const filename = `stock-report-${new Date().toISOString().slice(0, 10)}`;
      const filepath = await ExportHelper.exportStockExcel(stockData, filename);

      res.json({
        status: 'success',
        message: 'Stock report exported to Excel',
        data: {
          download_url: filepath,
          filename: `${filename}.xlsx`,
        },
      });
    } catch (error) {
      console.error('Export stock Excel error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to export stock report',
      });
    }
  }

  // Export customers to Excel
  static async exportCustomersExcel(req, res) {
    try {
      const CustomersQuery = `
        SELECT 
          c.customer_name,
          c.phone,
          c.address,
          c.nic,
          c.email,
          COUNT(DISTINCT s.sale_id) as total_purchases,
          COALESCE(SUM(s.total_amount), 0) as total_spent,
          COALESCE(SUM(s.balance_amount), 0) as outstanding_balance,
          MAX(s.sale_date) as last_purchase_date
        FROM customers c
        LEFT JOIN sales s ON c.customer_id = s.customer_id
        GROUP BY c.customer_id
        ORDER BY total_spent DESC
      `;

      const result = await db.query(CustomersQuery);

      const workbook = new (require('exceljs')).Workbook();
      const worksheet = workbook.addWorksheet('Customers');

      worksheet.columns = [
        { header: 'Customer Name', key: 'name', width: 30 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Address', key: 'address', width: 40 },
        { header: 'NIC', key: 'nic', width: 15 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Total Purchases', key: 'purchases', width: 15 },
        { header: 'Total Spent (Rs.)', key: 'spent', width: 15 },
        { header: 'Outstanding (Rs.)', key: 'outstanding', width: 15 },
        { header: 'Last Purchase', key: 'last_purchase', width: 15 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };

      result.rows.forEach(row => {
        worksheet.addRow({
          name: row.customer_name,
          phone: row.phone,
          address: row.address,
          nic: row.nic,
          email: row.email,
          purchases: parseInt(row.total_purchases),
          spent: parseFloat(row.total_spent),
          outstanding: parseFloat(row.outstanding_balance),
          last_purchase: row.last_purchase_date ? new Date(row.last_purchase_date).toLocaleDateString() : 'N/A',
        });
      });

      const path = require('path');
      const fs = require('fs').promises;
      const filename = `customers-${new Date().toISOString().slice(0, 10)}`;
      const filepath = path.join(__dirname, '../../public/exports', `${filename}.xlsx`);
      
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await workbook.xlsx.writeFile(filepath);

      res.json({
        status: 'success',
        message: 'Customers exported to Excel',
        data: {
          download_url: `/public/exports/${filename}.xlsx`,
          filename: `${filename}.xlsx`,
        },
      });
    } catch (error) {
      console.error('Export customers Excel error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to export customers',
      });
    }
  }
}

module.exports = ExportController;