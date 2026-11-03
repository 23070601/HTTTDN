// src/modules/inventory/inventory.controller.js

const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

const LOW_STOCK_THRESHOLD = parseInt(
  process.env.LOW_STOCK_THRESHOLD || '20',
  10
);

// =====================================================
// TRANSACTIONS
// =====================================================

async function listTransactions(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { product_id, transaction_type, warehouse, from, to } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (product_id) {
    where += ' AND st.product_id = ?';
    params.push(product_id);
  }

  if (transaction_type) {
    where += ' AND st.transaction_type = ?';
    params.push(transaction_type);
  }

  if (warehouse) {
    where += ' AND st.warehouse = ?';
    params.push(warehouse);
  }

  if (from) {
    where += ' AND DATE(st.created_at) >= ?';
    params.push(from);
  }

  if (to) {
    where += ' AND DATE(st.created_at) <= ?';
    params.push(to);
  }

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM stock_transactions st
       ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT
          st.*,
          p.product_name,
          p.sku,
          u.full_name AS staff_name
       FROM stock_transactions st
       JOIN products p ON p.product_id = st.product_id
       JOIN users u ON u.user_id = st.user_id
       ${where}
       ORDER BY st.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return R.paginated(res, {
      rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// =====================================================
// STOCK IN / ADJUSTMENT
// =====================================================

async function stockIn(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return R.badRequest(res, 'Validation failed', errors.array());
  }

  const {
    product_id,
    quantity,
    warehouse = 'HCM Warehouse',
    reference_id = null,
    note = null,
    transaction_type = 'Stock In',
  } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[product]] = await conn.query(
      `SELECT product_id, stock_quantity, status
       FROM products
       WHERE product_id = ?
       FOR UPDATE`,
      [product_id]
    );

    if (!product) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Product not found.');
    }

    const qty = Number(quantity);

    let stockChange = qty;

    // Adjustment = trừ kho
    if (transaction_type === 'Adjustment') {
      stockChange = -Math.abs(qty);
    }

    const newStock = Math.max(
      0,
      Number(product.stock_quantity) + stockChange
    );

    const newStatus =
      newStock <= 0 ? 'Out of Stock' : 'Available';

    await conn.query(
      `UPDATE products
       SET stock_quantity = ?,
           status = ?,
           updated_at = NOW()
       WHERE product_id = ?`,
      [newStock, newStatus, product_id]
    );

    await conn.query(
      `INSERT INTO stock_transactions
      (
        product_id,
        user_id,
        transaction_type,
        quantity,
        warehouse,
        reference_id,
        note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id,
        req.user.user_id,
        transaction_type,
        qty,
        warehouse,
        reference_id,
        note,
      ]
    );

    await conn.commit();
    conn.release();

    const [[updated]] = await pool.query(
      `SELECT product_id, stock_quantity, status
       FROM products
       WHERE product_id = ?`,
      [product_id]
    );

    return R.created(res, updated, 'Stock updated.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// =====================================================
// EXACT STOCK ADJUSTMENT
// =====================================================

async function adjustment(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return R.badRequest(res, 'Validation failed', errors.array());
  }

  const {
    product_id,
    new_quantity,
    note = '',
  } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[product]] = await conn.query(
      `SELECT product_id, stock_quantity
       FROM products
       WHERE product_id = ?
       FOR UPDATE`,
      [product_id]
    );

    if (!product) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Product not found.');
    }

    const oldQty = Number(product.stock_quantity);
    const targetQty = Number(new_quantity);

    if (oldQty === targetQty) {
      await conn.rollback();
      conn.release();
      return R.badRequest(
        res,
        'New quantity is the same as current.'
      );
    }

    await conn.query(
      `UPDATE products
       SET stock_quantity = ?,
           status = CASE
             WHEN ? <= 0 THEN 'Out of Stock'
             ELSE 'Available'
           END,
           updated_at = NOW()
       WHERE product_id = ?`,
      [targetQty, targetQty, product_id]
    );

    await conn.query(
      `INSERT INTO stock_transactions
      (
        product_id,
        user_id,
        transaction_type,
        quantity,
        warehouse,
        note
      )
      VALUES (?, ?, 'Adjustment', ?, 'HCM Warehouse', ?)`,
      [
        product_id,
        req.user.user_id,
        Math.abs(targetQty - oldQty),
        `Adjusted from ${oldQty} to ${targetQty}. ${note}`,
      ]
    );

    await conn.commit();
    conn.release();

    return R.ok(
      res,
      {
        product_id,
        old_quantity: oldQty,
        new_quantity: targetQty,
      },
      'Stock adjusted.'
    );
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// =====================================================
// ALERTS
// =====================================================

async function getAlerts(req, res) {
  const threshold = parseInt(
    req.query.threshold || LOW_STOCK_THRESHOLD,
    10
  );

  try {
    const [rows] = await pool.query(
      `SELECT
          p.product_id,
          p.product_name,
          p.sku,
          p.stock_quantity,
          p.status,
          c.category_name,
          CASE
            WHEN p.stock_quantity = 0 THEN 'Critical'
            WHEN p.stock_quantity <= 10 THEN 'High'
            ELSE 'Medium'
          END AS alert_level
       FROM products p
       LEFT JOIN categories c
         ON c.category_id = p.category_id
       WHERE p.stock_quantity <= ?
         AND p.status <> 'Discontinued'
       ORDER BY p.stock_quantity ASC`,
      [threshold]
    );

    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

module.exports = {
  listTransactions,
  stockIn,
  adjustment,
  getAlerts,
};