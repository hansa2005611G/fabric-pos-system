const BarcodeGenerator = require('../utils/barcodeGenerator');
const db = require('../config/database');

class BarcodeController {
  // Generate barcode for fabric
  static async generateFabricBarcode(req, res) {
    try {
      const { id } = req.params;

      // Get fabric
      const result = await db.query(
        'SELECT fabric_code FROM fabrics WHERE fabric_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Fabric not found',
        });
      }

      const fabricCode = result.rows[0].fabric_code;
      const barcodePath = await BarcodeGenerator.generateFabricBarcode(fabricCode);

      res.json({
        status: 'success',
        data: {
          barcode_url: barcodePath,
          barcode_text: `F-${fabricCode}`,
        },
      });
    } catch (error) {
      console.error('Generate fabric barcode error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate barcode',
      });
    }
  }

  // Generate barcode for roll
  static async generateRollBarcode(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT roll_code FROM fabric_rolls WHERE roll_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Roll not found',
        });
      }

      const rollCode = result.rows[0].roll_code;
      const barcodePath = await BarcodeGenerator.generateRollBarcode(rollCode);

      res.json({
        status: 'success',
        data: {
          barcode_url: barcodePath,
          barcode_text: `R-${rollCode}`,
        },
      });
    } catch (error) {
      console.error('Generate roll barcode error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate barcode',
      });
    }
  }

  // Generate barcode for accessory
  static async generateAccessoryBarcode(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT accessory_code FROM accessories WHERE accessory_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Accessory not found',
        });
      }

      const accessoryCode = result.rows[0].accessory_code;
      const barcodePath = await BarcodeGenerator.generateAccessoryBarcode(accessoryCode);

      res.json({
        status: 'success',
        data: {
          barcode_url: barcodePath,
          barcode_text: `A-${accessoryCode}`,
        },
      });
    } catch (error) {
      console.error('Generate accessory barcode error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate barcode',
      });
    }
  }

  // Generate barcode image directly (returns PNG)
  static async generateBarcodeImage(req, res) {
    try {
      const { text, type = 'code128' } = req.query;

      if (!text) {
        return res.status(400).json({
          status: 'error',
          message: 'Text parameter is required',
        });
      }

      const buffer = await BarcodeGenerator.generate(text, type);

      res.setHeader('Content-Type', 'image/png');
      res.send(buffer);
    } catch (error) {
      console.error('Generate barcode image error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate barcode',
      });
    }
  }

  // Generate QR code for invoice
  static async generateInvoiceQRCode(req, res) {
    try {
      const { invoice_number } = req.params;

      // Get invoice data
      const result = await db.query(
        `SELECT invoice_number, sale_date, total_amount, customer_name
         FROM sales WHERE invoice_number = $1`,
        [invoice_number]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Invoice not found',
        });
      }

      const buffer = await BarcodeGenerator.generateInvoiceQRCode(result.rows[0]);

      res.setHeader('Content-Type', 'image/png');
      res.send(buffer);
    } catch (error) {
      console.error('Generate invoice QR code error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate QR code',
      });
    }
  }

  // Scan/lookup barcode
  static async scanBarcode(req, res) {
    try {
      const { barcode } = req.body;
      const branch_id = req.user.branch_id;

      if (!barcode) {
        return res.status(400).json({
          status: 'error',
          message: 'Barcode is required',
        });
      }

      const parsed = BarcodeGenerator.parseBarcode(barcode);

      let result = null;

      if (parsed.type === 'fabric') {
        const query = `
          SELECT 
            f.fabric_id,
            f.fabric_code,
            f.fabric_name,
            f.color,
            f.selling_price_per_meter,
            COALESCE(SUM(CASE 
              WHEN fr.status = 'active' AND fr.branch_id = $1
              THEN fr.remaining_meters 
              ELSE 0 
            END), 0) as available_stock
          FROM fabrics f
          LEFT JOIN fabric_rolls fr ON f.fabric_id = fr.fabric_id
          WHERE f.fabric_code = $2
          GROUP BY f.fabric_id
        `;
        const dbResult = await db.query(query, [branch_id, parsed.code]);
        
        if (dbResult.rows.length > 0) {
          result = {
            type: 'fabric',
            data: {
              ...dbResult.rows[0],
              available_stock: parseFloat(dbResult.rows[0].available_stock),
              selling_price_per_meter: parseFloat(dbResult.rows[0].selling_price_per_meter),
            },
          };
        }
      } else if (parsed.type === 'roll') {
        const query = `
          SELECT 
            fr.roll_id,
            fr.roll_code,
            fr.remaining_meters,
            fr.rack_location,
            f.fabric_id,
            f.fabric_name,
            f.selling_price_per_meter
          FROM fabric_rolls fr
          INNER JOIN fabrics f ON fr.fabric_id = f.fabric_id
          WHERE fr.roll_code = $1
          AND fr.branch_id = $2
        `;
        const dbResult = await db.query(query, [parsed.code, branch_id]);
        
        if (dbResult.rows.length > 0) {
          result = {
            type: 'roll',
            data: {
              ...dbResult.rows[0],
              remaining_meters: parseFloat(dbResult.rows[0].remaining_meters),
              selling_price_per_meter: parseFloat(dbResult.rows[0].selling_price_per_meter),
            },
          };
        }
      } else if (parsed.type === 'accessory') {
        const query = `
          SELECT 
            a.accessory_id,
            a.accessory_code,
            a.accessory_name,
            a.unit,
            a.selling_price,
            a.current_stock
          FROM accessories a
          WHERE a.accessory_code = $1
          AND a.branch_id = $2
        `;
        const dbResult = await db.query(query, [parsed.code, branch_id]);
        
        if (dbResult.rows.length > 0) {
          result = {
            type: 'accessory',
            data: {
              ...dbResult.rows[0],
              selling_price: parseFloat(dbResult.rows[0].selling_price),
              current_stock: parseFloat(dbResult.rows[0].current_stock),
            },
          };
        }
      } else if (parsed.type === 'invoice') {
        const query = `
          SELECT 
            s.sale_id,
            s.invoice_number,
            s.customer_name,
            s.total_amount,
            s.sale_date,
            s.status
          FROM sales s
          WHERE s.invoice_number = $1
          AND s.branch_id = $2
        `;
        const dbResult = await db.query(query, [parsed.code, branch_id]);
        
        if (dbResult.rows.length > 0) {
          result = {
            type: 'invoice',
            data: {
              ...dbResult.rows[0],
              total_amount: parseFloat(dbResult.rows[0].total_amount),
            },
          };
        }
      }

      if (!result) {
        return res.status(404).json({
          status: 'error',
          message: 'Item not found or not available in this branch',
        });
      }

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      console.error('Scan barcode error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Barcode scan failed',
      });
    }
  }

  // Batch generate barcodes for all items
  static async batchGenerateBarcodes(req, res) {
    try {
      const { type } = req.params; // 'fabrics', 'rolls', 'accessories'
      const branch_id = req.user.branch_id;

      let items = [];
      let generateFunc = null;

      if (type === 'fabrics') {
        const result = await db.query('SELECT fabric_id, fabric_code FROM fabrics WHERE is_active = true');
        items = result.rows;
        generateFunc = BarcodeGenerator.generateFabricBarcode;
      } else if (type === 'rolls') {
        const result = await db.query(
          'SELECT roll_id, roll_code FROM fabric_rolls WHERE branch_id = $1 AND status = \'active\'',
          [branch_id]
        );
        items = result.rows;
        generateFunc = BarcodeGenerator.generateRollBarcode;
      } else if (type === 'accessories') {
        const result = await db.query(
          'SELECT accessory_id, accessory_code FROM accessories WHERE branch_id = $1 AND is_active = true',
          [branch_id]
        );
        items = result.rows;
        generateFunc = BarcodeGenerator.generateAccessoryBarcode;
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid type. Must be: fabrics, rolls, or accessories',
        });
      }

      const barcodes = [];

      for (const item of items) {
        try {
          const code = item.fabric_code || item.roll_code || item.accessory_code;
          const path = await generateFunc(code);
          barcodes.push({
            id: item.fabric_id || item.roll_id || item.accessory_id,
            code,
            barcode_url: path,
          });
        } catch (error) {
          console.error(`Failed to generate barcode for ${item}:`, error);
        }
      }

      res.json({
        status: 'success',
        message: `Generated ${barcodes.length} barcodes`,
        data: { barcodes },
      });
    } catch (error) {
      console.error('Batch generate barcodes error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Batch barcode generation failed',
      });
    }
  }
}

module.exports = BarcodeController;