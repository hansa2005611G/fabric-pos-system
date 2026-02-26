const db = require('../config/database');

class FabricCategoryModel {
  // Get all categories
  static async getAll() {
    const query = `
      SELECT 
        category_id,
        category_name,
        description
      FROM fabric_categories
      ORDER BY category_name ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  // Get category by ID
  static async getById(categoryId) {
    const query = `
      SELECT 
        category_id,
        category_name,
        description
      FROM fabric_categories
      WHERE category_id = $1
    `;
    
    const result = await db.query(query, [categoryId]);
    return result.rows[0];
  }

  // Create category
  static async create(data) {
    const { category_name, description } = data;
    
    const query = `
      INSERT INTO fabric_categories (category_name, description)
      VALUES ($1, $2)
      RETURNING category_id, category_name, description
    `;
    
    const result = await db.query(query, [category_name, description || null]);
    return result.rows[0];
  }

  // Update category
  static async update(categoryId, data) {
    const { category_name, description } = data;
    
    const query = `
      UPDATE fabric_categories
      SET 
        category_name = COALESCE($1, category_name),
        description = COALESCE($2, description)
      WHERE category_id = $3
      RETURNING category_id, category_name, description
    `;
    
    const result = await db.query(query, [
      category_name,
      description,
      categoryId
    ]);
    
    return result.rows[0];
  }

  // Delete category
  static async delete(categoryId) {
    // Check if category has fabrics
    const checkQuery = `
      SELECT COUNT(*) as fabric_count
      FROM fabrics
      WHERE category_id = $1
    `;
    const checkResult = await db.query(checkQuery, [categoryId]);
    
    if (parseInt(checkResult.rows[0].fabric_count) > 0) {
      throw new Error('Cannot delete category with existing fabrics');
    }
    
    const query = `
      DELETE FROM fabric_categories
      WHERE category_id = $1
      RETURNING category_id, category_name
    `;
    
    const result = await db.query(query, [categoryId]);
    return result.rows[0];
  }

  // Check if category name exists
  static async existsByName(categoryName, excludeId = null) {
    let query = `
      SELECT category_id
      FROM fabric_categories
      WHERE LOWER(category_name) = LOWER($1)
    `;
    
    const params = [categoryName];
    
    if (excludeId) {
      query += ` AND category_id != $2`;
      params.push(excludeId);
    }
    
    const result = await db.query(query, params);
    return result.rows.length > 0;
  }
}

module.exports = FabricCategoryModel;