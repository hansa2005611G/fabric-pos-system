const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class ExportHelper {
  /**
   * Export sales report to PDF
   */
  static async exportSalesPDF(salesData, summary, filename) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const filepath = path.join(__dirname, '../../public/exports', `${filename}.pdf`);

        // Create exports directory
        await fs.mkdir(path.dirname(filepath), { recursive: true });

        const writeStream = require('fs').createWriteStream(filepath);
        doc.pipe(writeStream);

        // Header
        doc.fontSize(20).text('Fabric POS System', { align: 'center' });
        doc.fontSize(16).text('Sales Report', { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(12).text(`Date Range: ${summary.date_from} to ${summary.date_to}`);
        doc.text(`Total Sales: ${summary.total_sales}`);
        doc.text(`Total Revenue: Rs. ${summary.total_revenue.toFixed(2)}`);
        doc.text(`Total Profit: Rs. ${summary.total_profit.toFixed(2)}`);
        doc.moveDown();

        // Table header
        doc.fontSize(10);
        const tableTop = doc.y;
        const colWidths = { date: 80, sales: 60, revenue: 100, profit: 100 };

        doc.text('Date', 50, tableTop);
        doc.text('Sales', 130, tableTop);
        doc.text('Revenue', 190, tableTop);
        doc.text('Profit', 290, tableTop);
        doc.moveDown();

        // Draw line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Table rows
        salesData.forEach(row => {
          const y = doc.y;
          doc.text(row.sale_date || row.date, 50, y);
          doc.text(row.total_sales || row.sales_count || 0, 130, y);
          doc.text(`Rs. ${parseFloat(row.total_revenue || row.revenue || 0).toFixed(2)}`, 190, y);
          doc.text(`Rs. ${parseFloat(row.total_profit || row.profit || 0).toFixed(2)}`, 290, y);
          doc.moveDown();
        });

        // Footer
        doc.moveDown();
        doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

        doc.end();

        writeStream.on('finish', () => {
          resolve(`/public/exports/${filename}.pdf`);
        });

        writeStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export sales report to Excel
   */
  static async exportSalesExcel(salesData, summary, filename) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      // Set column widths
      worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Total Sales', key: 'sales', width: 12 },
        { header: 'Revenue (Rs.)', key: 'revenue', width: 15 },
        { header: 'Profit (Rs.)', key: 'profit', width: 15 },
        { header: 'Discount (Rs.)', key: 'discount', width: 15 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Add summary at top
      worksheet.insertRow(1, ['Fabric POS System - Sales Report']);
      worksheet.insertRow(2, [`Date Range: ${summary.date_from} to ${summary.date_to}`]);
      worksheet.insertRow(3, []);
      worksheet.insertRow(4, ['Summary']);
      worksheet.insertRow(5, ['Total Sales:', summary.total_sales]);
      worksheet.insertRow(6, ['Total Revenue:', summary.total_revenue]);
      worksheet.insertRow(7, ['Total Profit:', summary.total_profit]);
      worksheet.insertRow(8, []);

      // Merge cells for title
      worksheet.mergeCells('A1:E1');
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      // Add data rows
      salesData.forEach(row => {
        worksheet.addRow({
          date: row.sale_date || row.date,
          sales: row.total_sales || row.sales_count || 0,
          revenue: parseFloat(row.total_revenue || row.revenue || 0),
          profit: parseFloat(row.total_profit || row.profit || 0),
          discount: parseFloat(row.total_discount || 0),
        });
      });

      // Format currency columns
      worksheet.getColumn('revenue').numFmt = '#,##0.00';
      worksheet.getColumn('profit').numFmt = '#,##0.00';
      worksheet.getColumn('discount').numFmt = '#,##0.00';

      // Save file
      const filepath = path.join(__dirname, '../../public/exports', `${filename}.xlsx`);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await workbook.xlsx.writeFile(filepath);

      return `/public/exports/${filename}.xlsx`;
    } catch (error) {
      throw new Error(`Excel export failed: ${error.message}`);
    }
  }

  /**
   * Export invoice to PDF
   */
  static async exportInvoicePDF(saleData, filename) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const filepath = path.join(__dirname, '../../public/exports', `${filename}.pdf`);

        await fs.mkdir(path.dirname(filepath), { recursive: true });

        const writeStream = require('fs').createWriteStream(filepath);
        doc.pipe(writeStream);

        // Header - Company Info
        doc.fontSize(20).text('Fabric POS System', { align: 'center' });
        doc.fontSize(10).text(saleData.branch_name, { align: 'center' });
        doc.text(saleData.branch_address || '', { align: 'center' });
        doc.text(`Phone: ${saleData.branch_phone || ''}`, { align: 'center' });
        doc.moveDown();

        // Invoice Title
        doc.fontSize(16).text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Invoice Details
        doc.fontSize(10);
        doc.text(`Invoice No: ${saleData.invoice_number}`, 50);
        doc.text(`Date: ${new Date(saleData.sale_date).toLocaleDateString()}`, 350);
        doc.text(`Customer: ${saleData.customer_name || 'Walk-in Customer'}`, 50);
        if (saleData.customer_phone) {
          doc.text(`Phone: ${saleData.customer_phone}`, 350);
        }
        doc.moveDown();

        // Draw line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Items table header
        const tableTop = doc.y;
        doc.text('Item', 50, tableTop);
        doc.text('Qty', 300, tableTop);
        doc.text('Unit Price', 350, tableTop);
        doc.text('Total', 450, tableTop);
        doc.moveDown();

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Items
        saleData.items.forEach(item => {
          const y = doc.y;
          doc.text(item.item_name, 50, y, { width: 240 });
          doc.text(`${item.quantity} ${item.unit}`, 300, y);
          doc.text(`Rs. ${parseFloat(item.unit_price).toFixed(2)}`, 350, y);
          doc.text(`Rs. ${parseFloat(item.line_total).toFixed(2)}`, 450, y);
          doc.moveDown();
        });

        // Totals
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        const totalsX = 350;
        doc.text('Subtotal:', totalsX, doc.y);
        doc.text(`Rs. ${parseFloat(saleData.subtotal).toFixed(2)}`, 450, doc.y);
        doc.moveDown();

        if (saleData.discount_amount > 0) {
          doc.text('Discount:', totalsX, doc.y);
          doc.text(`Rs. ${parseFloat(saleData.discount_amount).toFixed(2)}`, 450, doc.y);
          doc.moveDown();
        }

        if (saleData.tax_amount > 0) {
          doc.text('Tax:', totalsX, doc.y);
          doc.text(`Rs. ${parseFloat(saleData.tax_amount).toFixed(2)}`, 450, doc.y);
          doc.moveDown();
        }

        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Total:', totalsX, doc.y);
        doc.text(`Rs. ${parseFloat(saleData.total_amount).toFixed(2)}`, 450, doc.y);
        doc.moveDown();

        doc.fontSize(10).font('Helvetica');
        doc.text('Paid:', totalsX, doc.y);
        doc.text(`Rs. ${parseFloat(saleData.paid_amount).toFixed(2)}`, 450, doc.y);
        doc.moveDown();

        if (saleData.balance_amount > 0) {
          doc.text('Balance:', totalsX, doc.y);
          doc.text(`Rs. ${parseFloat(saleData.balance_amount).toFixed(2)}`, 450, doc.y);
          doc.moveDown();
        }

        // Payment method
        doc.moveDown();
        doc.text(`Payment Method: ${saleData.payment_method.toUpperCase()}`);

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).text('Thank you for your business!', { align: 'center' });
        doc.text(`Served by: ${saleData.created_by_name || saleData.created_by}`, { align: 'center' });

        doc.end();

        writeStream.on('finish', () => {
          resolve(`/public/exports/${filename}.pdf`);
        });

        writeStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export stock report to Excel
   */
  static async exportStockExcel(stockData, filename) {
    try {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Fabric Rolls
      const rollsSheet = workbook.addWorksheet('Fabric Rolls');
      rollsSheet.columns = [
        { header: 'Roll Code', key: 'roll_code', width: 20 },
        { header: 'Fabric Name', key: 'fabric_name', width: 30 },
        { header: 'Initial (m)', key: 'initial', width: 12 },
        { header: 'Remaining (m)', key: 'remaining', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Location', key: 'location', width: 15 },
      ];

      rollsSheet.getRow(1).font = { bold: true };
      rollsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };

      stockData.rolls.forEach(roll => {
        rollsSheet.addRow({
          roll_code: roll.roll_code,
          fabric_name: roll.fabric_name,
          initial: roll.initial_meters,
          remaining: roll.remaining_meters,
          status: roll.status,
          location: roll.rack_location,
        });
      });

      // Sheet 2: Accessories
      const accessoriesSheet = workbook.addWorksheet('Accessories');
      accessoriesSheet.columns = [
        { header: 'Code', key: 'code', width: 20 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Current Stock', key: 'stock', width: 15 },
        { header: 'Min Level', key: 'min', width: 12 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      accessoriesSheet.getRow(1).font = { bold: true };
      accessoriesSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };

      stockData.accessories.forEach(acc => {
        accessoriesSheet.addRow({
          code: acc.accessory_code,
          name: acc.accessory_name,
          stock: acc.current_stock,
          min: acc.min_stock_level,
          unit: acc.unit,
          status: acc.current_stock <= acc.min_stock_level ? 'LOW' : 'OK',
        });
      });

      const filepath = path.join(__dirname, '../../public/exports', `${filename}.xlsx`);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await workbook.xlsx.writeFile(filepath);

      return `/public/exports/${filename}.xlsx`;
    } catch (error) {
      throw new Error(`Stock export failed: ${error.message}`);
    }
  }
}

module.exports = ExportHelper;