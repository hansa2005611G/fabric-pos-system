const db = require('../config/database');

class DashboardModel {
  /**
   * Get comprehensive dashboard statistics
   */
  static async getDashboardStats(branchId) {
    // Get today's date
    const today = new Date().toISOString().slice(0, 10);

    // Today's sales
    const todaySalesQuery = `
      SELECT 
        COUNT(sale_id) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(balance_amount), 0) as total_credit,
        COALESCE(SUM(
          (SELECT SUM(si.line_total - (si.cost_price * si.quantity))
           FROM sales_items si
           WHERE si.sale_id = s.sale_id)
        ), 0) as total_profit
      FROM sales s
      WHERE s.branch_id = $1
      AND DATE(s.sale_date) = $2
      AND s.status != 'cancelled'
    `;

    // This month's sales
    const monthSalesQuery = `
      SELECT 
        COUNT(sale_id) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(
          (SELECT SUM(si.line_total - (si.cost_price * si.quantity))
           FROM sales_items si
           WHERE si.sale_id = s.sale_id)
        ), 0) as total_profit
      FROM sales s
      WHERE s.branch_id = $1
      AND EXTRACT(YEAR FROM s.sale_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND EXTRACT(MONTH FROM s.sale_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND s.status != 'cancelled'
    `;

    // Low stock count
    const lowStockQuery = `
      SELECT 
        (SELECT COUNT(*) 
         FROM fabric_rolls 
         WHERE branch_id = $1 
         AND status = 'active' 
         AND (remaining_meters < 5 OR remaining_meters / initial_meters < 0.1)
        ) as low_stock_rolls,
        (SELECT COUNT(*) 
         FROM accessories 
         WHERE branch_id = $1 
         AND is_active = true 
         AND current_stock <= min_stock_level
        ) as low_stock_accessories
    `;

    // Total customers
    const customersQuery = `
      SELECT 
        COUNT(*) as total_customers,
        (SELECT COUNT(DISTINCT customer_id)
         FROM sales
         WHERE branch_id = $1
         AND DATE(sale_date) = $2
        ) as today_customers
      FROM customers
    `;

    // Pending credit sales
    const creditQuery = `
      SELECT 
        COUNT(*) as pending_count,
        COALESCE(SUM(balance_amount), 0) as total_outstanding
      FROM sales
      WHERE branch_id = $1
      AND status = 'pending'
      AND balance_amount > 0
    `;

    // Recent sales (last 5)
    const recentSalesQuery = `
      SELECT 
        s.sale_id,
        s.invoice_number,
        s.customer_name,
        s.total_amount,
        s.payment_method,
        s.sale_date,
        s.created_at
      FROM sales s
      WHERE s.branch_id = $1
      AND s.status != 'cancelled'
      ORDER BY s.created_at DESC
      LIMIT 5
    `;

    // Stock value
    const stockValueQuery = `
      SELECT 
        (SELECT COALESCE(SUM(fr.remaining_meters * fr.purchase_cost_per_meter), 0)
         FROM fabric_rolls fr
         WHERE fr.branch_id = $1 AND fr.status = 'active'
        ) as fabric_value,
        (SELECT COALESCE(SUM(a.current_stock * a.cost_price), 0)
         FROM accessories a
         WHERE a.branch_id = $1 AND a.is_active = true
        ) as accessory_value
    `;

    // Top selling today
    const topSellingTodayQuery = `
      SELECT 
        si.item_name,
        si.item_type,
        COUNT(*) as times_sold,
        SUM(si.quantity) as total_quantity
      FROM sales_items si
      INNER JOIN sales s ON si.sale_id = s.sale_id
      WHERE s.branch_id = $1
      AND DATE(s.sale_date) = $2
      AND s.status != 'cancelled'
      GROUP BY si.item_name, si.item_type
      ORDER BY times_sold DESC, total_quantity DESC
      LIMIT 5
    `;

    // Execute all queries in parallel
    const [
      todaySales,
      monthSales,
      lowStock,
      customers,
      credit,
      recentSales,
      stockValue,
      topSelling,
    ] = await Promise.all([
      db.query(todaySalesQuery, [branchId, today]),
      db.query(monthSalesQuery, [branchId]),
      db.query(lowStockQuery, [branchId]),
      db.query(customersQuery, [branchId, today]),
      db.query(creditQuery, [branchId]),
      db.query(recentSalesQuery, [branchId]),
      db.query(stockValueQuery, [branchId]),
      db.query(topSellingTodayQuery, [branchId, today]),
    ]);

    // Format response
    return {
      today: {
        sales: parseInt(todaySales.rows[0].total_sales) || 0,
        revenue: parseFloat(todaySales.rows[0].total_revenue) || 0,
        profit: parseFloat(todaySales.rows[0].total_profit) || 0,
        credit: parseFloat(todaySales.rows[0].total_credit) || 0,
        customers: parseInt(customers.rows[0].today_customers) || 0,
      },
      this_month: {
        sales: parseInt(monthSales.rows[0].total_sales) || 0,
        revenue: parseFloat(monthSales.rows[0].total_revenue) || 0,
        profit: parseFloat(monthSales.rows[0].total_profit) || 0,
      },
      inventory: {
        low_stock_rolls: parseInt(lowStock.rows[0].low_stock_rolls) || 0,
        low_stock_accessories: parseInt(lowStock.rows[0].low_stock_accessories) || 0,
        total_low_stock: (parseInt(lowStock.rows[0].low_stock_rolls) || 0) + 
                        (parseInt(lowStock.rows[0].low_stock_accessories) || 0),
        fabric_stock_value: parseFloat(stockValue.rows[0].fabric_value) || 0,
        accessory_stock_value: parseFloat(stockValue.rows[0].accessory_value) || 0,
        total_stock_value: (parseFloat(stockValue.rows[0].fabric_value) || 0) + 
                           (parseFloat(stockValue.rows[0].accessory_value) || 0),
      },
      customers: {
        total: parseInt(customers.rows[0].total_customers) || 0,
        today: parseInt(customers.rows[0].today_customers) || 0,
      },
      credit_sales: {
        pending_count: parseInt(credit.rows[0].pending_count) || 0,
        total_outstanding: parseFloat(credit.rows[0].total_outstanding) || 0,
      },
      recent_sales: recentSales.rows.map(sale => ({
        ...sale,
        total_amount: parseFloat(sale.total_amount),
      })),
      top_selling_today: topSelling.rows.map(item => ({
        ...item,
        times_sold: parseInt(item.times_sold),
        total_quantity: parseFloat(item.total_quantity),
      })),
    };
  }

  /**
   * Get sales trend (last 7 days)
   */
  static async getSalesTrend(branchId, days = 7) {
    const query = `
      SELECT 
        DATE(s.sale_date) as date,
        COUNT(s.sale_id) as sales_count,
        COALESCE(SUM(s.total_amount), 0) as revenue,
        COALESCE(SUM(
          (SELECT SUM(si.line_total - (si.cost_price * si.quantity))
           FROM sales_items si
           WHERE si.sale_id = s.sale_id)
        ), 0) as profit
      FROM sales s
      WHERE s.branch_id = $1
      AND s.sale_date >= CURRENT_DATE - INTERVAL '${days} days'
      AND s.status != 'cancelled'
      GROUP BY DATE(s.sale_date)
      ORDER BY date ASC
    `;

    const result = await db.query(query, [branchId]);

    return result.rows.map(row => ({
      date: row.date,
      sales_count: parseInt(row.sales_count),
      revenue: parseFloat(row.revenue),
      profit: parseFloat(row.profit),
    }));
  }

  /**
   * Get payment method breakdown (today)
   */
  static async getPaymentMethodBreakdown(branchId) {
    const today = new Date().toISOString().slice(0, 10);

    const query = `
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total_amount) as amount
      FROM sales
      WHERE branch_id = $1
      AND DATE(sale_date) = $2
      AND status != 'cancelled'
      GROUP BY payment_method
      ORDER BY amount DESC
    `;

    const result = await db.query(query, [branchId, today]);

    return result.rows.map(row => ({
      payment_method: row.payment_method,
      count: parseInt(row.count),
      amount: parseFloat(row.amount),
    }));
  }

  /**
   * Get hourly sales (today)
   */
  static async getHourlySales(branchId) {
    const today = new Date().toISOString().slice(0, 10);

    const query = `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as sales_count,
        SUM(total_amount) as revenue
      FROM sales
      WHERE branch_id = $1
      AND DATE(sale_date) = $2
      AND status != 'cancelled'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour ASC
    `;

    const result = await db.query(query, [branchId, today]);

    // Create array for all 24 hours
    const hourlyData = Array(24).fill(null).map((_, hour) => ({
      hour,
      sales_count: 0,
      revenue: 0,
    }));

    // Fill in actual data
    result.rows.forEach(row => {
      const hour = parseInt(row.hour);
      hourlyData[hour] = {
        hour,
        sales_count: parseInt(row.sales_count),
        revenue: parseFloat(row.revenue),
      };
    });

    return hourlyData;
  }

  /**
   * Get alerts (critical notifications)
   */
  static async getAlerts(branchId) {
    const alerts = [];

    // Check low stock
    const lowStockQuery = `
      SELECT COUNT(*) as count
      FROM (
        SELECT roll_id FROM fabric_rolls
        WHERE branch_id = $1 AND status = 'active'
        AND (remaining_meters < 5 OR remaining_meters / initial_meters < 0.1)
        UNION ALL
        SELECT accessory_id FROM accessories
        WHERE branch_id = $1 AND is_active = true
        AND current_stock <= min_stock_level
      ) as low_stock
    `;

    const lowStockResult = await db.query(lowStockQuery, [branchId]);
    const lowStockCount = parseInt(lowStockResult.rows[0].count);

    if (lowStockCount > 0) {
      alerts.push({
        type: 'warning',
        category: 'inventory',
        message: `${lowStockCount} item(s) are low on stock`,
        action_url: '/api/reports/low-stock',
        priority: 'high',
      });
    }

    // Check pending credit sales
    const creditQuery = `
      SELECT COUNT(*) as count, SUM(balance_amount) as amount
      FROM sales
      WHERE branch_id = $1
      AND status = 'pending'
      AND balance_amount > 0
    `;

    const creditResult = await db.query(creditQuery, [branchId]);
    const pendingCount = parseInt(creditResult.rows[0].count);
    const pendingAmount = parseFloat(creditResult.rows[0].amount);

    if (pendingCount > 0) {
      alerts.push({
        type: 'info',
        category: 'sales',
        message: `${pendingCount} pending credit sale(s) totaling Rs. ${pendingAmount.toFixed(2)}`,
        action_url: '/api/sales?status=pending',
        priority: 'medium',
      });
    }

    // Check if any rolls are finished today
    const finishedRollsQuery = `
      SELECT COUNT(*) as count
      FROM fabric_rolls
      WHERE branch_id = $1
      AND status = 'finished'
      AND DATE(updated_at) = CURRENT_DATE
    `;

    const finishedResult = await db.query(finishedRollsQuery, [branchId]);
    const finishedCount = parseInt(finishedResult.rows[0].count);

    if (finishedCount > 0) {
      alerts.push({
        type: 'success',
        category: 'inventory',
        message: `${finishedCount} roll(s) finished today`,
        action_url: '/api/fabric-rolls?status=finished',
        priority: 'low',
      });
    }

    return alerts;
  }

  /**
   * Get quick stats (for widgets)
   */
  static async getQuickStats(branchId) {
    const today = new Date().toISOString().slice(0, 10);

    const query = `
      SELECT 
        -- Today's stats
        (SELECT COUNT(*) FROM sales 
         WHERE branch_id = $1 AND DATE(sale_date) = $2 AND status != 'cancelled'
        ) as today_sales,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales 
         WHERE branch_id = $1 AND DATE(sale_date) = $2 AND status != 'cancelled'
        ) as today_revenue,
        -- Total customers
        (SELECT COUNT(*) FROM customers) as total_customers,
        -- Active fabric rolls
        (SELECT COUNT(*) FROM fabric_rolls 
         WHERE branch_id = $1 AND status = 'active'
        ) as active_rolls,
        -- Total accessories in stock
        (SELECT COUNT(*) FROM accessories 
         WHERE branch_id = $1 AND is_active = true AND current_stock > 0
        ) as accessories_in_stock,
        -- Pending payments
        (SELECT COALESCE(SUM(balance_amount), 0) FROM sales 
         WHERE branch_id = $1 AND status = 'pending'
        ) as pending_payments
    `;

    const result = await db.query(query, [branchId, today]);
    const stats = result.rows[0];

    return {
      today_sales: parseInt(stats.today_sales) || 0,
      today_revenue: parseFloat(stats.today_revenue) || 0,
      total_customers: parseInt(stats.total_customers) || 0,
      active_rolls: parseInt(stats.active_rolls) || 0,
      accessories_in_stock: parseInt(stats.accessories_in_stock) || 0,
      pending_payments: parseFloat(stats.pending_payments) || 0,
    };
  }
}

module.exports = DashboardModel;