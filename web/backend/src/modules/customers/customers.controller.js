// src/modules/customers/customers.controller.js
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

async function list(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { segment, customer_type, city, search } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (segment) { where += ' AND segment = ?'; params.push(segment); }
  if (customer_type) { where += ' AND customer_type = ?'; params.push(customer_type); }
  if (city)    { where += ' AND city = ?';    params.push(city); }
  if (search)  {
    where += ' AND (full_name LIKE ? OR email LIKE ? OR phone_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM customers ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// Search customers by phone or name (for autocomplete in order form)
async function search(req, res) {
  try {
    const { q } = req.query;
    console.log('[SEARCH] ===== START =====');
    console.log('[SEARCH] Query param received:', q, 'Type:', typeof q);
    
    if (!q || q.trim().length < 1) {
      console.log('[SEARCH] Query too short, returning empty array');
      return res.status(200).json({ success: true, data: [] });
    }

    const searchTerm = `%${q.trim()}%`;
    console.log('[SEARCH] Prepared search term:', searchTerm);
    console.log('[SEARCH] About to execute query...');

    const [rows] = await pool.query(
      `SELECT customer_id, full_name, phone_number, email, customer_type 
       FROM customers 
       WHERE phone_number LIKE ? OR full_name LIKE ? OR email LIKE ?
       ORDER BY phone_number DESC, full_name ASC
       LIMIT 20`,
      [searchTerm, searchTerm, searchTerm]
    );
    
    console.log('[SEARCH] Query executed successfully');
    console.log(`[SEARCH] Found ${rows.length} customers`);
    console.log('[SEARCH] Results:', JSON.stringify(rows));
    console.log('[SEARCH] ===== END =====');
    
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[SEARCH] ===== ERROR =====');
    console.error('[SEARCH] Error message:', err.message);
    console.error('[SEARCH] Error code:', err.code);
    console.error('[SEARCH] Error stack:', err.stack);
    console.error('[SEARCH] ===== END ERROR =====');
    return res.status(500).json({ 
      success: false, 
      message: 'Search error: ' + err.message,
      errorCode: err.code 
    });
  }
}

async function getOne(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Customer not found.');

    // Summary stats
    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(total_amount), 0) AS total_spent,
              MAX(ordered_at) AS last_order_at
       FROM orders WHERE customer_id = ? AND delivery_status <> 'Cancelled'`,
      [req.params.id]
    );
    return R.ok(res, { ...rows[0], stats });
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const { full_name, email, phone_number, customer_type = 'retail', gender, date_of_birth, address, city, segment = 'New' } = req.body;
  try {
    const [dup] = await pool.query('SELECT customer_id FROM customers WHERE email = ?', [email]);
    if (dup.length) return R.conflict(res, 'Email already registered.');

    const [result] = await pool.query(
      'INSERT INTO customers (full_name, email, phone_number, customer_type, gender, date_of_birth, address, city, segment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [full_name, email, phone_number || null, customer_type, gender || null, date_of_birth || null, address || null, city || null, segment]
    );
    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [result.insertId]);
    return R.created(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function update(req, res) {
  const { full_name, phone_number, customer_type, gender, date_of_birth, address, city, segment } = req.body;
  const fields = []; const params = [];

  if (full_name    !== undefined) { fields.push('full_name = ?');    params.push(full_name); }
  if (phone_number !== undefined) { fields.push('phone_number = ?'); params.push(phone_number); }
  if (customer_type!== undefined) { fields.push('customer_type = ?');params.push(customer_type); }
  if (gender       !== undefined) { fields.push('gender = ?');       params.push(gender); }
  if (date_of_birth!== undefined) { fields.push('date_of_birth = ?');params.push(date_of_birth); }
  if (address      !== undefined) { fields.push('address = ?');      params.push(address); }
  if (city         !== undefined) { fields.push('city = ?');         params.push(city); }
  if (segment      !== undefined) { fields.push('segment = ?');      params.push(segment); }

  if (!fields.length) return R.badRequest(res, 'No fields to update.');
  params.push(req.params.id);

  try {
    const [result] = await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE customer_id = ?`, params);
    if (!result.affectedRows) return R.notFound(res, 'Customer not found.');
    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Customer updated.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getOrders(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  try {
    const [rows] = await pool.query('SELECT customer_id FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Customer not found.');

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM orders WHERE customer_id = ?', [req.params.id]
    );
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY ordered_at DESC LIMIT ? OFFSET ?',
      [req.params.id, limit, offset]
    );
    return R.paginated(res, { rows: orders, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getLoyaltyHistory(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM loyalty_transactions WHERE customer_id = ?', [req.params.id]
    );
    const [rows] = await pool.query(
      `SELECT lt.*, o.order_number
       FROM loyalty_transactions lt
       LEFT JOIN orders o ON o.order_id = lt.order_id
       WHERE lt.customer_id = ?
       ORDER BY lt.created_at DESC LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// POST /customers/:id/redeem-points
async function redeemPoints(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const { points, order_id = null, description = 'Manual redemption' } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[customer]] = await conn.query(
      'SELECT customer_id, loyalty_points_balance FROM customers WHERE customer_id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!customer) { await conn.rollback(); conn.release(); return R.notFound(res, 'Customer not found.'); }
    if (customer.loyalty_points_balance < points) {
      await conn.rollback(); conn.release();
      return R.badRequest(res, `Insufficient points. Balance: ${customer.loyalty_points_balance}.`);
    }

    // Deduct points (trigger guards against negative)
    await conn.query(
      'UPDATE customers SET loyalty_points_balance = loyalty_points_balance - ? WHERE customer_id = ?',
      [points, req.params.id]
    );

    // Record transaction
    await conn.query(
      "INSERT INTO loyalty_transactions (customer_id, order_id, action_type, points_amount, description) VALUES (?, ?, 'redeem', ?, ?)",
      [req.params.id, order_id, -points, description]
    );

    await conn.commit();
    conn.release();

    const [[updated]] = await pool.query('SELECT loyalty_points_balance FROM customers WHERE customer_id = ?', [req.params.id]);
    return R.ok(res, { redeemed: points, new_balance: updated.loyalty_points_balance }, 'Points redeemed.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    if (err.sqlState === '45000') return R.badRequest(res, err.sqlMessage);
    return R.serverError(res, err);
  }
}

module.exports = { list, search, getOne, create, update, getOrders, getLoyaltyHistory, redeemPoints };