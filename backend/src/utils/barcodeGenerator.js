const bwipjs = require('bwip-js');
const fs = require('fs').promises;
const path = require('path');

class BarcodeGenerator {
  /**
   * Generate barcode image
   * @param {string} text - Text to encode
   * @param {string} type - Barcode type (code128, ean13, qrcode)
   * @returns {Buffer} Image buffer
   */
  static async generate(text, type = 'code128') {
    try {
      const buffer = await bwipjs.toBuffer({
        bcid: type,        // Barcode type
        text: text,        // Text to encode
        scale: 3,          // 3x scaling factor
        height: 10,        // Bar height, in millimeters
        includetext: true, // Show human-readable text
        textxalign: 'center',
      });

      return buffer;
    } catch (error) {
      throw new Error(`Barcode generation failed: ${error.message}`);
    }
  }

  /**
   * Generate barcode and save to file
   * @param {string} text - Text to encode
   * @param {string} filename - Output filename
   * @param {string} type - Barcode type
   * @returns {string} File path
   */
  static async generateAndSave(text, filename, type = 'code128') {
    try {
      const buffer = await this.generate(text, type);
      
      // Create barcodes directory if not exists
      const barcodesDir = path.join(__dirname, '../../public/barcodes');
      await fs.mkdir(barcodesDir, { recursive: true });

      // Save file
      const filepath = path.join(barcodesDir, `${filename}.png`);
      await fs.writeFile(filepath, buffer);

      return `/barcodes/${filename}.png`;
    } catch (error) {
      throw new Error(`Barcode save failed: ${error.message}`);
    }
  }

  /**
   * Generate QR code
   * @param {string} data - Data to encode (can be JSON)
   * @returns {Buffer} Image buffer
   */
  static async generateQRCode(data) {
    try {
      const buffer = await bwipjs.toBuffer({
        bcid: 'qrcode',
        text: typeof data === 'string' ? data : JSON.stringify(data),
        scale: 3,
        width: 20,
        height: 20,
      });

      return buffer;
    } catch (error) {
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate barcode for fabric
   * Format: F-{FABRIC_CODE}
   */
  static async generateFabricBarcode(fabricCode) {
    const barcodeText = `F-${fabricCode}`;
    const filename = `fabric-${fabricCode}`;
    return await this.generateAndSave(barcodeText, filename);
  }

  /**
   * Generate barcode for fabric roll
   * Format: R-{ROLL_CODE}
   */
  static async generateRollBarcode(rollCode) {
    const barcodeText = `R-${rollCode}`;
    const filename = `roll-${rollCode}`;
    return await this.generateAndSave(barcodeText, filename);
  }

  /**
   * Generate barcode for accessory
   * Format: A-{ACCESSORY_CODE}
   */
  static async generateAccessoryBarcode(accessoryCode) {
    const barcodeText = `A-${accessoryCode}`;
    const filename = `accessory-${accessoryCode}`;
    return await this.generateAndSave(barcodeText, filename);
  }

  /**
   * Generate QR code for invoice
   */
  static async generateInvoiceQRCode(invoiceData) {
    const qrData = {
      invoice: invoiceData.invoice_number,
      date: invoiceData.sale_date,
      total: invoiceData.total_amount,
      customer: invoiceData.customer_name,
    };
    
    return await this.generateQRCode(qrData);
  }

  /**
   * Parse barcode text to identify type and ID
   */
  static parseBarcode(barcodeText) {
    if (barcodeText.startsWith('F-')) {
      return {
        type: 'fabric',
        code: barcodeText.substring(2),
      };
    } else if (barcodeText.startsWith('R-')) {
      return {
        type: 'roll',
        code: barcodeText.substring(2),
      };
    } else if (barcodeText.startsWith('A-')) {
      return {
        type: 'accessory',
        code: barcodeText.substring(2),
      };
    } else if (barcodeText.startsWith('INV-')) {
      return {
        type: 'invoice',
        code: barcodeText,
      };
    } else {
      return {
        type: 'unknown',
        code: barcodeText,
      };
    }
  }
}

module.exports = BarcodeGenerator;