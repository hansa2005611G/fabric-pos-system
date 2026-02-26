const db = require('../config/database');
const bcrypt = require('bcrypt');

class UserModel {
  // Find user by username
  static async findByUsername(username) {
    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.password_hash,
        u.full_name,
        u.role,
        u.branch_id,
        u.is_active,
        u.last_login,
        b.branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.username = $1
    `;
    
    const result = await db.query(query, [username]);
    return result.rows[0];
  }

  // Find user by ID
  static async findById(userId) {
    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.full_name,
        u.role,
        u.branch_id,
        u.is_active,
        u.created_at,
        u.last_login,
        b.branch_name,
        b.address as branch_address,
        b.phone as branch_phone
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.user_id = $1
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Hash password
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  // Update last login
  static async updateLastLogin(userId) {
    const query = `
      UPDATE users 
      SET last_login = NOW() 
      WHERE user_id = $1
      RETURNING last_login
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  // Create new user (for Phase 2, but schema ready now)
  static async create(userData) {
    const { username, password, full_name, role, branch_id } = userData;
    
    const hashedPassword = await this.hashPassword(password);
    
    const query = `
      INSERT INTO users (username, password_hash, full_name, role, branch_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, username, full_name, role, branch_id, created_at
    `;
    
    const result = await db.query(query, [
      username,
      hashedPassword,
      full_name,
      role,
      branch_id || process.env.DEFAULT_BRANCH_ID,
    ]);
    
    return result.rows[0];
  }

  // Get all users (for admin)
  static async getAll() {
    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.full_name,
        u.role,
        u.branch_id,
        u.is_active,
        u.created_at,
        u.last_login,
        b.branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      ORDER BY u.created_at DESC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  // Update user status (activate/deactivate)
  static async updateStatus(userId, isActive) {
    const query = `
      UPDATE users 
      SET is_active = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING user_id, username, is_active
    `;
    
    const result = await db.query(query, [isActive, userId]);
    return result.rows[0];
  }
}

module.exports = UserModel;