const db = require('../config/database');

class ReportModel {
  /**
   * Get sales summary report by date range
   */
  static async getSalesSummary(branchId, dateFrom, dateTo) {
    const query = `
      SELECT 
        DATE(s.sale_date) as sale_date,
        COUNT(s.sale_id) as total_sales,
        SUM(s.subtotal) as total_subtotal,
        SUM(s.discount_amount) as total_discount,
        SUM(s.total_amount) as total_revenue,
        SUM(s.paid_amount) as total_paid,
        SUM(s.balance_amount) as total_credit,
        -- Calculate profit
        SUM(
          (SELECT COALESCE(SUM(si.line_total - (si.cost_price * si.quantity)), 0)
           FROM sales_items si
           WHERE si.sale_id = s.sale_id)
        ) as total_profit,
        -- Payment method breakdown
        COUNT(CASE WHEN s.payment_method = 'cash' THEN 1 END) as cash_sales,
        COUNT(CASE WHEN s.payment_method = 'card' THEN 1 END) as card_sales,
        COUNT(CASE WHEN s.payment_method = 'credit' THEN 1 END) as credit_sales
      FROM sales s
      WHERE s.branch_id = $1
      AND DATE(s.sale_date) BETWEEN $2 AND $3
      AND s.status != 'cancelled'
      GROUP BY DATE(s.sale_date)
      ORDER BY sale_date DESC
    `;

    const result = await db.query(query, [branchId, dateFrom, dateTo]);

    return result.rows.map(row => ({
      ...row,
      total_sales: parseInt(row.total_sales),
      total_subtotal: parseFloat(row.total_subtotal),
      total_discount: parseFloat(row.total_discount),
      total_revenue: parseFloat(row.total_revenue),
      total_paid: parseFloat(row.total_paid),
      total_credit: parseFloat(row.total_credit),
      total_profit: parseFloat(row.total_profit),
      cash_sales: parseInt(row.cash_sales),
      card_sales: parseInt(row.card_sales),
      credit_sales: parseInt(row.credit_sales),
    }));
  }

  /**
   * Get top selling fabrics
   */
  static async getTopSellingFabrics(branchId, dateFrom, dateTo, limit = 10) {
    const query = `
      SELECT 
        f.fabric_id,
        f.fabric_code,
        f.fabric_name,
        fc.category_name,
        COUNT(DISTINCT si.sale_id) as times_sold,
        SUM(si.quantity) as total_quantity_sold,
        si.unit,
        SUM(si.line_total) as total_revenue,
        SUM(si.line_total - (si.cost_price * si.quantity)) as total_profit
      FROM sales_items si
      INNER JOIN sales s ON si.sale_id = s.sale_id
      INNER JOIN fabrics f ON si.fabric_id = f.fabric_id
      LEFT JOIN fabric_categories fc ON f.category_id = fc.category_id
      WHERE s.branch_id = $1
      AND DATE(s.sale_date) BETWEEN $2 AND $3
      AND si.item_type = 'fabric'
      AND s.status != 'cancelled'
      GROUP BY f.fabric_id, f.fabric_code, f.fabric_name, fc.category_name, si.unit
      ORDER BY total_revenue DESC
      LIMIT $4
    `;

    const result = await db.query(query, [branchId, dateFrom, dateTo, limit]);

    return result.rows.map(row => ({
      ...row,
      times_sold: parseInt(row.times_sold),
      total_quantity_sold: parseFloat(row.total_quantity_sold),
      total_revenue: parseFloat(row.total_revenue),
      total_profit: parseFloat(row.total_profit),
    }));
  }

  /**
   * Get top selling accessories
   */
  static async getTopSellingAccessories(branchId, dateFrom, dateTo, limit = 10) {
    const query = `
      SELECT 
        a.accessory_id,
        a.accessory_code,
        a.accessory_name,
        ac.category_name,
        COUNT(DISTINCT si.sale_id) as times_sold,
        SUM(si.quantity) as total_quantity_sold,
        si.unit,
        SUM(si.line_total) as total_revenue,
        SUM(si.line_total - (si.cost_price * si.quantity)) as total_profit
      FROM sales_items si
      INNER JOIN sales s ON si.sale_id = s.sale_id
      INNER JOIN accessories a ON si.accessory_id = a.accessory_id
      LEFT JOIN accessory_categories ac ON a.category_id = ac.category_id
      WHERE s.branch_id = $1
      AND DATE(s.sale_date) BETWEEN $2 AND $3
      AND si.item_type = 'accessory'
      AND s.status != 'cancelled'
      GROUP BY a.accessory_id, a.accessory_code, a.accessory_name, ac.category_name, si.unit
      ORDER BY total_revenue DESC
      LIMIT $4
    `;

    const result = await db.query(query, [branchId, dateFrom, dateTo, limit]);

    return result.rows.map(row => ({
      ...row,
      times_sold: parseInt(row.times_sold),
      total_quantity_sold: parseFloat(row.total_quantity_sold),
      total_revenue: parseFloat(row.total_revenue),
      total_profit: parseFloat(row.total_profit),
    }));
  }

  /**
   * Get monthly sales report
   */
  static async getMonthlySalesReport(branchId, year, month) {
    const query = `
      SELECT 
        COUNT(s.sale_id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        SUM(s.paid_amount) as total_paid,
        SUM(s.balance_amount) as total_credit,
        SUM(
          (SELECT COALESCE(SUM(si.line_total - (si.cost_price * si.quantity)), 0)
           FROM sales_items si
           WHERE si.sale_id = s.sale_id)
        ) as total_profit,
        -- Average sale value
        AVG(s.total_amount) as average_sale_value,
        -- Count by payment method
        COUNT(CASE WHEN s.payment_method = 'cash' THEN 1 END) as cash_count,
        SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount ELSE 0 END) as cash_amount,
        COUNT(CASE WHEN s.payment_method = 'card' THEN 1 END) as card_count,
        SUM(CASE WHEN s.payment_method = 'card' THEN s.total_amount ELSE 0 END) as card_amount,
        COUNT(CASE WHEN s.payment_method = 'credit' THEN 1 END) as credit_count,
        SUM(CASE WHEN s.payment_method = 'credit' THEN s.total_amount ELSE 0 END) as credit_amount,
        -- Count unique customers
        COUNT(DISTINCT s.customer_id) as unique_customers
      FROM sales s
      WHERE s.branch_id = $1
      AND EXTRACT(YEAR FROM s.sale_date) = $2
      AND EXTRACT(MONTH FROM s.sale_date) = $3
      AND s.status != 'cancelled'
    `;

    const result = await db.query(query, [branchId, year, month]);

    const summary = result.rows[0];

    return {
      year: parseInt(year),
      month: parseInt(month),
      total_sales: parseInt(summary.total_sales) || 0,
      total_revenue: parseFloat(summary.total_revenue) || 0,
      total_paid: parseFloat(summary.total_paid) || 0,
      total_credit: parseFloat(summary.total_credit) || 0,
      total_profit: parseFloat(summary.total_profit) || 0,
      average_sale_value: parseFloat(summary.average_sale_value) || 0,
      payment_methods: {
        cash: {
          count: parseInt(summary.cash_count) || 0,
          amount: parseFloat(summary.cash_amount) || 0,
        },
        card: {
          count: parseInt(summary.card_count) || 0,
          amount: parseFloat(summary.card_amount) || 0,
        },
        credit: {
          count: parseInt(summary.credit_count) || 0,
          amount: parseFloat(summary.credit_amount) || 0,
        },
      },
      unique_customers: parseInt(summary.unique_customers) || 0,
    };
  }

  /**
   * Get yearly sales report
   */
  static async getYearlySalesReport(branchId, year) {
    const query = `
      SELECT 
        EXTRACT(MONTH FROM s.sale_date) as month,
        COUNT(s.sale_id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        SUM(
          (SELECT COALESCE(SUM(si.line_total - (si.cost_price * si.quantity)), 0)
           FROM sales_items si
           WHERE si.sale_id = s.sale_id)
        ) as total_profit
      FROM sales s
      WHERE s.branch_id = $1
      AND EXTRACT(YEAR FROM s.sale_date) = $2
      AND s.status != 'cancelled'
      GROUP BY EXTRACT(MONTH FROM s.sale_date)
      ORDER BY month
    `;

    const result = await db.query(query, [branchId, year]);

    // Create array for all 12 months
    const monthlyData = Array(12).fill(null).map((_, index) => ({
      month: index + 1,
      total_sales: 0,
      total_revenue: 0,
      total_profit: 0,
    }));

    // Fill in actual data
    result.rows.forEach(row => {
      const monthIndex = parseInt(row.month) - 1;
      monthlyData[monthIndex] = {
        month: parseInt(row.month),
        total_sales: parseInt(row.total_sales),
        total_revenue: parseFloat(row.total_revenue),
        total_profit: parseFloat(row.total_profit),
      };
    });

    // Calculate yearly totals
    const yearlyTotal = {
      year: parseInt(year),
      total_sales: monthlyData.reduce((sum, m) => sum + m.total_sales, 0),
      total_revenue: monthlyData.reduce((sum, m) => sum + m.total_revenue, 0),
      total_profit: monthlyData.reduce((sum, m) => sum + m.total_profit, 0),
    };

    return {
      summary: yearlyTotal,
      monthly_breakdown: monthlyData,
    };
  }

  /**
   * Get profit analysis report
   */
  static async getProfitAnalysis(branchId, dateFrom, dateTo) {
    const query = `
      SELECT 
        -- Overall
        SUM(si.line_total) as total_revenue,
        SUM(si.cost_price * si.quantity) as total_cost,
        SUM(si.line_total - (si.cost_price * si.quantity)) as total_profit,
        -- By item type
        SUM(CASE WHEN si.item_type = 'fabric' THEN si.line_total ELSE 0 END) as fabric_revenue,
        SUM(CASE WHEN si.item_type = 'fabric' THEN (si.cost_price * si.quantity) ELSE 0 END) as fabric_cost,
        SUM(CASE WHEN si.item_type = 'fabric' THEN (si.line_total - (si.cost_price * si.quantity)) ELSE 0 END) as fabric_profit,
        SUM(CASE WHEN si.item_type = 'accessory' THEN si.line_total ELSE 0 END) as accessory_revenue,
        SUM(CASE WHEN si.item_type = 'accessory' THEN (si.cost_price * si.quantity) ELSE 0 END) as accessory_cost,
        SUM(CASE WHEN si.item_type = 'accessory' THEN (si.line_total - (si.cost_price * si.quantity)) ELSE 0 END) as accessory_profit
      FROM sales_items si
      INNER JOIN sales s ON si.sale_id = s.sale_id
      WHERE s.branch_id = $1
      AND DATE(s.sale_date) BETWEEN $2 AND $3
      AND s.status != 'cancelled'
    `;

    const result = await db.query(query, [branchId, dateFrom, dateTo]);

    const data = result.rows[0];

    const totalRevenue = parseFloat(data.total_revenue) || 0;
    const totalCost = parseFloat(data.total_cost) || 0;
    const totalProfit = parseFloat(data.total_profit) || 0;

    return {
      date_from: dateFrom,
      date_to: dateTo,
      overall: {
        total_revenue: totalRevenue,
        total_cost: totalCost,
        total_profit: totalProfit,
        profit_margin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0,
      },
      by_category: {
        fabric: {
          revenue: parseFloat(data.fabric_revenue) || 0,
          cost: parseFloat(data.fabric_cost) || 0,
          profit: parseFloat(data.fabric_profit) || 0,
          profit_margin: parseFloat(data.fabric_revenue) > 0 
            ? (((parseFloat(data.fabric_profit) / parseFloat(data.fabric_revenue)) * 100).toFixed(2))
            : 0,
        },
        accessory: {
          revenue: parseFloat(data.accessory_revenue) || 0,
          cost: parseFloat(data.accessory_cost) || 0,
          profit: parseFloat(data.accessory_profit) || 0,
          profit_margin: parseFloat(data.accessory_revenue) > 0 
            ? (((parseFloat(data.accessory_profit) / parseFloat(data.accessory_revenue)) * 100).toFixed(2))
            : 0,
        },
      },
    };
  }

  /**
   * Get low stock report
   */
  static async getLowStockReport(branchId) {
    // Get low stock fabric rolls
    const fabricRollsQuery = `
      SELECT 
        'fabric_roll' as item_type,
        fr.roll_id as id,
        fr.roll_code as code,
        f.fabric_name as name,
        fr.remaining_meters as current_stock,
        fr.rack_location,
        'meter' as unit
      FROM fabric_rolls fr
      INNER JOIN fabrics f ON fr.fabric_id = f.fabric_id
      WHERE fr.branch_id = $1
      AND fr.status = 'active'
      AND (fr.remaining_meters < 5 OR fr.remaining_meters / fr.initial_meters < 0.1)
      ORDER BY fr.remaining_meters ASC
    `;

    // Get low stock accessories
    const accessoriesQuery = `
      SELECT 
        'accessory' as item_type,
        a.accessory_id as id,
        a.accessory_code as code,
        a.accessory_name as name,
        a.current_stock,
        a.min_stock_level,
        a.unit
      FROM accessories a
      WHERE a.branch_id = $1
      AND a.is_active = true
      AND a.current_stock <= a.min_stock_level
      ORDER BY a.current_stock ASC
    `;

    const [rollsResult, accessoriesResult] = await Promise.all([
      db.query(fabricRollsQuery, [branchId]),
      db.query(accessoriesQuery, [branchId]),
    ]);

    return {
      fabric_rolls: rollsResult.rows.map(row => ({
        ...row,
        current_stock: parseFloat(row.current_stock),
      })),
      accessories: accessoriesResult.rows.map(row => ({
        ...row,
        current_stock: parseFloat(row.current_stock),
        min_stock_level: parseFloat(row.min_stock_level),
      })),
      total_low_stock_items: rollsResult.rows.length + accessoriesResult.rows.length,
    };
  }

  /**
   * Get top customers report
   */
  static async getTopCustomers(branchId, dateFrom, dateTo, limit = 10) {
    const query = `
      SELECT 
        c.customer_id,
        c.customer_name,
        c.phone,
        COUNT(s.sale_id) as total_purchases,
        SUM(s.total_amount) as total_spent,
        SUM(s.balance_amount) as outstanding_balance,
        MAX(s.sale_date) as last_purchase_date,
        AVG(s.total_amount) as average_purchase_value
      FROM customers c
      INNER JOIN sales s ON c.customer_id = s.customer_id
      WHERE s.branch_id = $1
      AND DATE(s.sale_date) BETWEEN $2 AND $3
      AND s.status != 'cancelled'
      GROUP BY c.customer_id, c.customer_name, c.phone
      ORDER BY total_spent DESC
      LIMIT $4
    `;

    const result = await db.query(query, [branchId, dateFrom, dateTo, limit]);

    return result.rows.map(row => ({
      ...row,
      total_purchases: parseInt(row.total_purchases),
      total_spent: parseFloat(row.total_spent),
      outstanding_balance: parseFloat(row.outstanding_balance),
      average_purchase_value: parseFloat(row.average_purchase_value),
    }));
  }

  /**
   * Get stock value report
   */
  static async getStockValueReport(branchId) {
    // Calculate fabric stock value
    const fabricQuery = `
      SELECT 
        SUM(fr.remaining_meters * fr.purchase_cost_per_meter) as total_fabric_value,
        COUNT(fr.roll_id) as total_rolls
      FROM fabric_rolls fr
      WHERE fr.branch_id = $1
      AND fr.status = 'active'
    `;

    // Calculate accessory stock value
    const accessoryQuery = `
      SELECT 
        SUM(a.current_stock * a.cost_price) as total_accessory_value,
        COUNT(a.accessory_id) as total_accessories
      FROM accessories a
      WHERE a.branch_id = $1
      AND a.is_active = true
    `;

    const [fabricResult, accessoryResult] = await Promise.all([
      db.query(fabricQuery, [branchId]),
      db.query(accessoryQuery, [branchId]),
    ]);

    const fabricValue = parseFloat(fabricResult.rows[0].total_fabric_value) || 0;
    const accessoryValue = parseFloat(accessoryResult.rows[0].total_accessory_value) || 0;

    return {
      fabric_stock: {
        total_value: fabricValue,
        total_rolls: parseInt(fabricResult.rows[0].total_rolls) || 0,
      },
      accessory_stock: {
        total_value: accessoryValue,
        total_items: parseInt(accessoryResult.rows[0].total_accessories) || 0,
      },
      total_stock_value: fabricValue + accessoryValue,
    };
  }
}

module.exports = ReportModel;