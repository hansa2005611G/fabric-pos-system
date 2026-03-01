const db = require('../config/database');

class SearchController {
  // Quick search for fabrics (autocomplete)
  static async searchFabrics(req, res) {
    try {
      const { q, limit = 10 } = req.query;
      const branch_id = req.user.branch_id;

      if (!q || q.length < 2) {
        return res.json({
          status: 'success',
          data: { results: [] },
        });
      }

      const query = `
        SELECT 
          f.fabric_id,
          f.fabric_code,
          f.fabric_name,
          f.color,
          fc.category_name,
          f.selling_price_per_meter,
          -- Available stock
          COALESCE(SUM(CASE 
            WHEN fr.status = 'active' AND fr.branch_id = $1
            THEN fr.remaining_meters 
            ELSE 0 
          END), 0) as available_stock
        FROM fabrics f
        LEFT JOIN fabric_categories fc ON f.category_id = fc.category_id
        LEFT JOIN fabric_rolls fr ON f.fabric_id = fr.fabric_id
        WHERE f.is_active = true
        AND (
          f.fabric_name ILIKE $2 OR
          f.fabric_code ILIKE $2 OR
          f.color ILIKE $2
        )
        GROUP BY f.fabric_id, fc.category_name
        HAVING COALESCE(SUM(CASE 
          WHEN fr.status = 'active' AND fr.branch_id = $1
          THEN fr.remaining_meters 
          ELSE 0 
        END), 0) > 0
        ORDER BY f.fabric_name
        LIMIT $3
      `;

      const result = await db.query(query, [branch_id, `%${q}%`, limit]);

      const results = result.rows.map(row => ({
        type: 'fabric',
        id: row.fabric_id,
        code: row.fabric_code,
        name: row.fabric_name,
        color: row.color,
        category: row.category_name,
        price: parseFloat(row.selling_price_per_meter),
        available_stock: parseFloat(row.available_stock),
        unit: 'meter',
      }));

      res.json({
        status: 'success',
        data: { results },
      });
    } catch (error) {
      console.error('Search fabrics error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Search failed',
      });
    }
  }

  // Quick search for accessories (autocomplete)
  static async searchAccessories(req, res) {
    try {
      const { q, limit = 10 } = req.query;
      const branch_id = req.user.branch_id;

      if (!q || q.length < 2) {
        return res.json({
          status: 'success',
          data: { results: [] },
        });
      }

      const query = `
        SELECT 
          a.accessory_id,
          a.accessory_code,
          a.accessory_name,
          ac.category_name,
          a.unit,
          a.selling_price,
          a.current_stock
        FROM accessories a
        LEFT JOIN accessory_categories ac ON a.category_id = ac.category_id
        WHERE a.branch_id = $1
        AND a.is_active = true
        AND a.current_stock > 0
        AND (
          a.accessory_name ILIKE $2 OR
          a.accessory_code ILIKE $2
        )
        ORDER BY a.accessory_name
        LIMIT $3
      `;

      const result = await db.query(query, [branch_id, `%${q}%`, limit]);

      const results = result.rows.map(row => ({
        type: 'accessory',
        id: row.accessory_id,
        code: row.accessory_code,
        name: row.accessory_name,
        category: row.category_name,
        price: parseFloat(row.selling_price),
        available_stock: parseFloat(row.current_stock),
        unit: row.unit,
      }));

      res.json({
        status: 'success',
        data: { results },
      });
    } catch (error) {
      console.error('Search accessories error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Search failed',
      });
    }
  }

  // Universal search (fabrics + accessories combined)
  static async universalSearch(req, res) {
    try {
      const { q, limit = 10 } = req.query;
      const branch_id = req.user.branch_id;

      if (!q || q.length < 2) {
        return res.json({
          status: 'success',
          data: { results: [] },
        });
      }

      // Search fabrics
      const fabricQuery = `
        SELECT 
          'fabric' as type,
          f.fabric_id as id,
          f.fabric_code as code,
          f.fabric_name as name,
          f.color,
          fc.category_name,
          f.selling_price_per_meter as price,
          COALESCE(SUM(CASE 
            WHEN fr.status = 'active' AND fr.branch_id = $1
            THEN fr.remaining_meters 
            ELSE 0 
          END), 0) as available_stock,
          'meter' as unit
        FROM fabrics f
        LEFT JOIN fabric_categories fc ON f.category_id = fc.category_id
        LEFT JOIN fabric_rolls fr ON f.fabric_id = fr.fabric_id
        WHERE f.is_active = true
        AND (
          f.fabric_name ILIKE $2 OR
          f.fabric_code ILIKE $2 OR
          f.color ILIKE $2
        )
        GROUP BY f.fabric_id, fc.category_name
        HAVING COALESCE(SUM(CASE 
          WHEN fr.status = 'active' AND fr.branch_id = $1
          THEN fr.remaining_meters 
          ELSE 0 
        END), 0) > 0
      `;

      // Search accessories
      const accessoryQuery = `
        SELECT 
          'accessory' as type,
          a.accessory_id as id,
          a.accessory_code as code,
          a.accessory_name as name,
          NULL as color,
          ac.category_name,
          a.selling_price as price,
          a.current_stock as available_stock,
          a.unit
        FROM accessories a
        LEFT JOIN accessory_categories ac ON a.category_id = ac.category_id
        WHERE a.branch_id = $1
        AND a.is_active = true
        AND a.current_stock > 0
        AND (
          a.accessory_name ILIKE $2 OR
          a.accessory_code ILIKE $2
        )
      `;

      // Combine queries
      const combinedQuery = `
        (${fabricQuery})
        UNION ALL
        (${accessoryQuery})
        ORDER BY name
        LIMIT $3
      `;

      const result = await db.query(combinedQuery, [branch_id, `%${q}%`, limit]);

      const results = result.rows.map(row => ({
        type: row.type,
        id: parseInt(row.id),
        code: row.code,
        name: row.name,
        color: row.color,
        category: row.category_name,
        price: parseFloat(row.price),
        available_stock: parseFloat(row.available_stock),
        unit: row.unit,
      }));

      res.json({
        status: 'success',
        data: { results },
      });
    } catch (error) {
      console.error('Universal search error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Search failed',
      });
    }
  }

  // Get available rolls for a specific fabric
  static async getFabricRolls(req, res) {
    try {
      const { fabric_id } = req.params;
      const branch_id = req.user.branch_id;

      const query = `
        SELECT 
          fr.roll_id,
          fr.roll_code,
          fr.remaining_meters,
          fr.rack_location,
          fr.purchase_cost_per_meter
        FROM fabric_rolls fr
        WHERE fr.fabric_id = $1
        AND fr.branch_id = $2
        AND fr.status = 'active'
        AND fr.remaining_meters > 0
        ORDER BY fr.remaining_meters DESC
      `;

      const result = await db.query(query, [fabric_id, branch_id]);

      const rolls = result.rows.map(row => ({
        roll_id: row.roll_id,
        roll_code: row.roll_code,
        remaining_meters: parseFloat(row.remaining_meters),
        rack_location: row.rack_location,
        cost_per_meter: parseFloat(row.purchase_cost_per_meter),
      }));

      res.json({
        status: 'success',
        data: { rolls },
      });
    } catch (error) {
      console.error('Get fabric rolls error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch rolls',
      });
    }
  }
}

module.exports = SearchController;