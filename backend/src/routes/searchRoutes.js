const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/searchController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Universal search (fabrics + accessories)
router.get('/', SearchController.universalSearch);

// Search fabrics only
router.get('/fabrics', SearchController.searchFabrics);

// Search accessories only
router.get('/accessories', SearchController.searchAccessories);

// Get available rolls for a fabric
router.get('/fabrics/:fabric_id/rolls', SearchController.getFabricRolls);

module.exports = router;