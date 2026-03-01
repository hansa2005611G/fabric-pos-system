const ExcelJS = require('exceljs');
const db = require('../config/database');
const FabricModel = require('../models/fabricModel');
const AccessoryModel = require('../models/accessoryModel');
const CustomerModel = require('../models/customerModel');

class ImportController {
  /**
   * Import fabrics from Excel
   * Expected columns: fabric_name, category_id, brand, color, width_inches, cost_price, selling_price, wholesale_price
   */
  static async importFabrics(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);

      const worksheet = workbook.worksheets[0];
      const results = {
        success: [],
        errors: [],
      };

      // Skip header row
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        
        try {
          const fabricData = {
            fabric_name: row.getCell(1).value,
            category_id: row.getCell(2).value,
            brand: row.getCell(3).value,
            color: row.getCell(4).value,
            width_inches: row.getCell(5).value,
            cost_price: row.getCell(6).value,
            selling_price: row.getCell(7).value,
            wholesale_price: row.getCell(8).value,
            description: row.getCell(9).value,
          };

          // Validate required fields
          if (!fabricData.fabric_name || !fabricData.cost_price || !fabricData.selling_price) {
            results.errors.push({
              row: i,
              error: 'Missing required fields (fabric_name, cost_price, selling_price)',
            });
            continue;
          }

          // Create fabric
          const fabric = await FabricModel.create(fabricData, 'meter');
          results.success.push({
            row: i,
            fabric_code: fabric.fabric_code,
            fabric_name: fabric.fabric_name,
          });
        } catch (error) {
          results.errors.push({
            row: i,
            error: error.message,
          });
        }
      }

      res.json({
        status: 'success',
        message: `Imported ${results.success.length} fabrics, ${results.errors.length} errors`,
        data: results,
      });
    } catch (error) {
      console.error('Import fabrics error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to import fabrics',
        details: error.message,
      });
    }
  }

  /**
   * Import accessories from Excel
   * Expected columns: accessory_name, category_id, unit, cost_price, selling_price, current_stock, min_stock_level
   */
  static async importAccessories(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
      }

      const branch_id = req.user.branch_id;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);

      const worksheet = workbook.worksheets[0];
      const results = {
        success: [],
        errors: [],
      };

      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        
        try {
          const accessoryData = {
            accessory_name: row.getCell(1).value,
            category_id: row.getCell(2).value,
            unit: row.getCell(3).value,
            cost_price: row.getCell(4).value,
            selling_price: row.getCell(5).value,
            current_stock: row.getCell(6).value || 0,
            min_stock_level: row.getCell(7).value || 0,
            description: row.getCell(8).value,
          };

          // Validate
          if (!accessoryData.accessory_name || !accessoryData.unit || !accessoryData.cost_price || !accessoryData.selling_price) {
            results.errors.push({
              row: i,
              error: 'Missing required fields',
            });
            continue;
          }

          // Validate unit
          const validUnits = ['piece', 'pack', 'box', 'meter', 'set'];
          if (!validUnits.includes(accessoryData.unit)) {
            results.errors.push({
              row: i,
              error: `Invalid unit. Must be: ${validUnits.join(', ')}`,
            });
            continue;
          }

          const accessory = await AccessoryModel.create(accessoryData, branch_id);
          results.success.push({
            row: i,
            accessory_code: accessory.accessory_code,
            accessory_name: accessory.accessory_name,
          });
        } catch (error) {
          results.errors.push({
            row: i,
            error: error.message,
          });
        }
      }

      res.json({
        status: 'success',
        message: `Imported ${results.success.length} accessories, ${results.errors.length} errors`,
        data: results,
      });
    } catch (error) {
      console.error('Import accessories error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to import accessories',
      });
    }
  }

  /**
   * Import customers from Excel
   * Expected columns: customer_name, phone, address, nic, email
   */
  static async importCustomers(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);

      const worksheet = workbook.worksheets[0];
      const results = {
        success: [],
        errors: [],
      };

      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        
        try {
          const customerData = {
            customer_name: row.getCell(1).value,
            phone: row.getCell(2).value,
            address: row.getCell(3).value,
            nic: row.getCell(4).value,
            email: row.getCell(5).value,
            notes: row.getCell(6).value,
          };

          if (!customerData.customer_name) {
            results.errors.push({
              row: i,
              error: 'Customer name is required',
            });
            continue;
          }

          // Check if phone exists
          if (customerData.phone) {
            const exists = await CustomerModel.existsByPhone(customerData.phone);
            if (exists) {
              results.errors.push({
                row: i,
                error: 'Phone number already exists',
              });
              continue;
            }
          }

          const customer = await CustomerModel.create(customerData);
          results.success.push({
            row: i,
            customer_id: customer.customer_id,
            customer_name: customer.customer_name,
          });
        } catch (error) {
          results.errors.push({
            row: i,
            error: error.message,
          });
        }
      }

      res.json({
        status: 'success',
        message: `Imported ${results.success.length} customers, ${results.errors.length} errors`,
        data: results,
      });
    } catch (error) {
      console.error('Import customers error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to import customers',
      });
    }
  }

  /**
   * Download import template
   */
  static async downloadTemplate(req, res) {
    try {
      const { type } = req.params; // 'fabrics', 'accessories', 'customers'

      const workbook = new ExcelJS.Workbook();
      let worksheet;

      if (type === 'fabrics') {
        worksheet = workbook.addWorksheet('Fabrics Template');
        worksheet.columns = [
          { header: 'Fabric Name*', key: 'name', width: 30 },
          { header: 'Category ID', key: 'category', width: 12 },
          { header: 'Brand', key: 'brand', width: 20 },
          { header: 'Color', key: 'color', width: 15 },
          { header: 'Width (inches)', key: 'width', width: 15 },
          { header: 'Cost Price*', key: 'cost', width: 15 },
          { header: 'Selling Price*', key: 'selling', width: 15 },
          { header: 'Wholesale Price', key: 'wholesale', width: 15 },
          { header: 'Description', key: 'description', width: 30 },
        ];
        
        // Add sample row
        worksheet.addRow({
          name: 'Premium Blackout - Navy',
          category: 1,
          brand: 'Luxury Textiles',
          color: 'Navy Blue',
          width: 60,
          cost: 850,
          selling: 1300,
          wholesale: 1100,
          description: 'High quality blackout fabric',
        });
      } else if (type === 'accessories') {
        worksheet = workbook.addWorksheet('Accessories Template');
        worksheet.columns = [
          { header: 'Accessory Name*', key: 'name', width: 30 },
          { header: 'Category ID', key: 'category', width: 12 },
          { header: 'Unit* (piece/pack/box/set)', key: 'unit', width: 20 },
          { header: 'Cost Price*', key: 'cost', width: 15 },
          { header: 'Selling Price*', key: 'selling', width: 15 },
          { header: 'Current Stock', key: 'stock', width: 15 },
          { header: 'Min Stock Level', key: 'min', width: 15 },
          { header: 'Description', key: 'description', width: 30 },
        ];
        
        worksheet.addRow({
          name: 'Curtain Rings - Metal Silver',
          category: 1,
          unit: 'pack',
          cost: 150,
          selling: 250,
          stock: 50,
          min: 10,
          description: 'Pack of 12 rings',
        });
      } else if (type === 'customers') {
        worksheet = workbook.addWorksheet('Customers Template');
        worksheet.columns = [
          { header: 'Customer Name*', key: 'name', width: 30 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Address', key: 'address', width: 40 },
          { header: 'NIC', key: 'nic', width: 15 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Notes', key: 'notes', width: 30 },
        ];
        
        worksheet.addRow({
          name: 'John Doe',
          phone: '0771234567',
          address: 'No. 123, Main Street, Colombo',
          nic: '123456789V',
          email: 'john@example.com',
          notes: 'VIP Customer',
        });
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid template type. Must be: fabrics, accessories, or customers',
        });
      }

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Send file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-import-template.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Download template error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate template',
      });
    }
  }
}

module.exports = ImportController;