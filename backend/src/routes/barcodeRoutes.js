const express = require('express');
const router = express.Router();
const BarcodeController = require('../controllers/barcodeController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Generate barcode image directly (PNG response)
router.get('/image', BarcodeController.generateBarcodeImage);

// Scan/lookup barcode
router.post('/scan', BarcodeController.scanBarcode);

// Generate barcode for specific item
router.post('/fabrics/:id', authorize('admin', 'manager'), BarcodeController.generateFabricBarcode);
router.post('/rolls/:id', authorize('admin', 'manager'), BarcodeController.generateRollBarcode);
router.post('/accessories/:id', authorize('admin', 'manager'), BarcodeController.generateAccessoryBarcode);

// Generate QR code for invoice
router.get('/invoice/:invoice_number/qr', BarcodeController.generateInvoiceQRCode);

// Batch generate barcodes
router.post('/batch/:type', authorize('admin', 'manager'), BarcodeController.batchGenerateBarcodes);

module.exports = router;