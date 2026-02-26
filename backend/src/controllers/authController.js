const UserModel = require('../models/userModel');
const { generateToken } = require('../utils/jwtHelper');

class AuthController {
  // Login
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await UserModel.findByUsername(username);

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          status: 'error',
          message: 'Your account has been deactivated. Contact administrator.',
        });
      }

      // Verify password
      const isPasswordValid = await UserModel.verifyPassword(
        password,
        user.password_hash
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      // Update last login
      await UserModel.updateLastLogin(user.user_id);

      // Generate JWT token
      const token = generateToken({
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
      });

      // Remove password from response
      delete user.password_hash;

      // Send response
      res.json({
        status: 'success',
        message: 'Login successful',
        data: {
          token,
          user: {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            branch_id: user.branch_id,
            branch_name: user.branch_name,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Login failed. Please try again.',
      });
    }
  }

  // Get current user (profile)
  static async getProfile(req, res) {
    try {
      // req.user is set by auth middleware
      const user = await UserModel.findById(req.user.user_id);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      res.json({
        status: 'success',
        data: {
          user: {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            branch_id: user.branch_id,
            branch_name: user.branch_name,
            branch_address: user.branch_address,
            branch_phone: user.branch_phone,
            last_login: user.last_login,
          },
        },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch profile',
      });
    }
  }

  // Logout (client-side token removal, but you can add token blacklist in Phase 3)
  static async logout(req, res) {
    try {
      // In Phase 1, logout is client-side (delete token)
      // In Phase 3, add token to blacklist table
      
      res.json({
        status: 'success',
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Logout failed',
      });
    }
  }

  // Verify token (useful for frontend to check if token is valid)
  static async verifyToken(req, res) {
    try {
      // If middleware passes, token is valid
      res.json({
        status: 'success',
        message: 'Token is valid',
        data: {
          user: req.user, // From middleware
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Token verification failed',
      });
    }
  }
}

module.exports = AuthController;