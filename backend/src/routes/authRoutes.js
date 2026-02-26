const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginValidation, validate } = require('../utils/validators');

// Public routes
router.post('/login', loginValidation, validate, AuthController.login);

// Protected routes (require authentication)
router.get('/profile', authenticate, AuthController.getProfile);
router.post('/logout', authenticate, AuthController.logout);
router.get('/verify', authenticate, AuthController.verifyToken);

module.exports = router;