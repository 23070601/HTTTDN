// src/modules/analytics/analytics.controller.js
// ============================================================
//  Analytical SQL queries for the Manager Dashboard
//  Covers: Revenue, Orders, Customers (RFM), Inventory alerts
// ============================================================
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

// ─── DASHBOARD SUMMARY ────────────────────────────────────────
async function dashboard(req, res) {
  try {
    const [[revenue]] = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_revenue_today,
        COUNT(*) AS orders_today
      FROM orders
      WHERE DATE(ordered_at) = CURDATE()
        AND delivery_status NOT IN ('Cancelled', 'Returned')
    `);

    const [[monthly]] = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_revenue_month,
        COUNT(*) AS orders_month
      FROM orders
      WHERE YEAR(ordered_at) = YEAR(NOW())
        AND MONTH(ordered_at) = MONTH(NOW())
        AND delivery_status NOT IN ('Cancelled', 'Returned')
    `);

    const [[customers]] = await pool.query(`
      SELECT
        COUNT(*) AS total_customers,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_today
      FROM customers
    `);

    const [[pendingOrders]] = await pool.query(`
      SELECT COUNT(*) AS pending
      FROM orders
      WHERE delivery_status = 'Pending'
    `);

    const [[lowStock]] = await pool.query(`
      SELECT COUNT(*) AS low_stock
      FROM products
      WHERE stock_quantity <= 20
        AND status <> 'Discontinued'
    `);

    const [[dealerDebt]] = await pool.query(`
      SELECT
        COALESCE(SUM(debt_amount), 0) AS total_debt,
        SUM(CASE WHEN debt_status = 'Overdue' THEN 1 ELSE 0 END) AS overdue_dealers
      FROM dealers
      WHERE partner_status = 'Active'
    `);

    return R.ok(res, {
      revenue_today: revenue.total_revenue_today,
      orders_today: revenue.orders_today,

      revenue_month: monthly.total_revenue_month,
      orders_month: monthly.orders_month,

      total_customers: customers.total_customers,
      new_customers_today: customers.new_today,

      pending_orders: pendingOrders.pending,
      low_stock_products: lowStock.low_stock,

      total_dealer_debt: dealerDebt.total_debt,
      overdue_dealers: dealerDebt.overdue_dealers
    });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ─────────────────────────────────────────
// REVENUE MONTHLY
// ─────────────────────────────────────────
async function revenueMonthly(req, res) {
  const months = parseInt(req.query.months || '12');

  try {
    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(ordered_at, '%Y-%m') AS month,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(*) AS orders,
        COALESCE(SUM(shipping_fee), 0) AS shipping_revenue
      FROM orders
      WHERE ordered_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        AND delivery_status NOT IN ('Cancelled', 'Returned')
      GROUP BY DATE_FORMAT(ordered_at, '%Y-%m')
      ORDER BY month ASC
    `, [months]);

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// REVENUE BY CHANNEL
// ============================================================
async function revenueByChannel(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        COALESCE(sales_channel,'Unknown') AS sales_channel,
        COUNT(*) AS orders,
        SUM(total_amount) AS revenue
      FROM orders
      WHERE delivery_status <> 'Cancelled'
      GROUP BY sales_channel
      ORDER BY revenue DESC
    `);

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// REVENUE BY PRODUCT
// ============================================================
async function revenueByProduct(req, res) {
  const { from, to, limit = 20 } = req.query;

  try {
    let where = `
      WHERE o.delivery_status NOT IN ('Cancelled','Returned')
    `;
    const params = [];

    if (from) {
      where += ` AND DATE(o.ordered_at) >= ?`;
      params.push(from);
    }

    if (to) {
      where += ` AND DATE(o.ordered_at) <= ?`;
      params.push(to);
    }

    const [rows] = await pool.query(`
      SELECT
        p.product_id,
        p.product_name,
        p.sku,
        c.category_name,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.subtotal) AS revenue
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      ${where}
      GROUP BY p.product_id
      ORDER BY revenue DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// CUSTOMER SEGMENTS
// ============================================================
async function customerSegments(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        segment,
        COUNT(*) AS count,
        ROUND(
          COUNT(*) * 100.0 /
          SUM(COUNT(*)) OVER (),
          2
        ) AS percentage,
        ROUND(AVG(loyalty_points_balance), 1)
          AS avg_loyalty_points
      FROM customers
      GROUP BY segment
      ORDER BY count DESC
    `);

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// RFM ANALYSIS
// ============================================================
async function rfmAnalysis(req, res) {
  const { limit: lim = 50 } = req.query;

  try {
    const [rows] = await pool.query(`
      SELECT
        c.customer_id,
        c.full_name,
        c.email,
        c.segment,
        c.loyalty_points_balance,
        DATEDIFF(NOW(), MAX(o.ordered_at)) AS recency_days,
        COUNT(o.order_id) AS frequency,
        COALESCE(SUM(o.total_amount), 0) AS monetary,
        ROUND(AVG(o.total_amount), 2) AS avg_order_value,
        MAX(o.ordered_at) AS last_order_at
      FROM customers c
      LEFT JOIN orders o
        ON o.customer_id = c.customer_id
       AND o.delivery_status NOT IN ('Cancelled', 'Returned')
      GROUP BY
        c.customer_id,
        c.full_name,
        c.email,
        c.segment,
        c.loyalty_points_balance
      HAVING frequency > 0
      ORDER BY monetary DESC
      LIMIT ?
    `, [parseInt(lim)]);

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// TOP CUSTOMERS
// ============================================================
async function topCustomers(req, res) {
  const { limit: lim = 10 } = req.query;

  try {
    const [rows] = await pool.query(`
      SELECT
        c.customer_id,
        c.full_name,
        c.email,
        c.phone_number,
        c.segment,
        COUNT(o.order_id) AS orders,
        SUM(o.total_amount) AS total_spent
      FROM customers c
      JOIN orders o ON o.customer_id = c.customer_id
      WHERE o.delivery_status NOT IN ('Cancelled', 'Returned')
      GROUP BY
        c.customer_id,
        c.full_name,
        c.email,
        c.phone_number,
        c.segment
      ORDER BY total_spent DESC
      LIMIT ?
    `, [parseInt(lim)]);

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// LOW STOCK SUMMARY
// ============================================================
async function lowStockSummary(req, res) {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
        SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= 10 THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN stock_quantity > 10 AND stock_quantity <= 20 THEN 1 ELSE 0 END) AS warning
      FROM products
      WHERE status <> 'Discontinued'
    `);

    return R.ok(res, summary);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// LOW STOCK PRODUCTS
// ============================================================
async function lowStockProducts(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        product_id,
        product_name,
        sku,
        stock_quantity,
        status
      FROM products
      WHERE stock_quantity <= 20
        AND status <> 'Discontinued'
      ORDER BY stock_quantity ASC
      LIMIT 20
    `);

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ============================================================
// AUDIT LOGS
// ============================================================
async function auditLogs(req, res) {
  const { page, limit, offset } = getPagination(req.query);

  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM audit_logs'
    );

    const [rows] = await pool.query(`
      SELECT al.*, u.full_name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.user_id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return R.paginated(res, {
      rows,
      total,
      page,
      limit
    });
  } catch (err) {
    return R.serverError(res, err);
  }
}

module.exports = {
  dashboard,
  revenueMonthly,
  revenueByChannel,
  revenueByProduct,
  customerSegments,
  rfmAnalysis,
  topCustomers,
  lowStockSummary,
  lowStockProducts,
  auditLogs
};