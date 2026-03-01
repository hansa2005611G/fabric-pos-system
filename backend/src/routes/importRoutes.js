const express = require('express');
const router = express.Router();
const ImportController = require('../controllers/importController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication and admin/manager role
router.use(authenticate);
router.use(authorize('admin', 'manager'));

// Download templates
router.get('/template/:type', ImportController.downloadTemplate);

// Import data
router.post('/fabrics', upload.single('file'), ImportController.importFabrics);
router.post('/accessories', upload.single('file'), ImportController.importAccessories);
router.post('/customers', upload.single('file'), ImportController.importCustomers);

module.exports = router;