// src/modules/promotions/promotions.controller.js
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

async function list(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { status, promo_type } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (status)     { where += ' AND status = ?';     params.push(status); }
  if (promo_type) { where += ' AND promo_type = ?'; params.push(promo_type); }

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM promotions ${where}`, params
    );
    const [rows] = await pool.query(
      `SELECT * FROM promotions ${where} ORDER BY start_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// Only currently running promotions
async function getActive(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM promotions
       WHERE status = 'Active'
         AND start_date <= CURDATE()
         AND end_date   >= CURDATE()
       ORDER BY discount_rate DESC`
    );
    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getOne(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM promotions WHERE promotion_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Promotion not found.');
    return R.ok(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const { promotion_name, discount_rate, promo_type, start_date, end_date, status = 'Active' } = req.body;

  if (new Date(end_date) < new Date(start_date)) {
    return R.badRequest(res, 'end_date must be >= start_date.');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO promotions (promotion_name, discount_rate, promo_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)',
      [promotion_name, discount_rate, promo_type, start_date, end_date, status]
    );
    const [rows] = await pool.query('SELECT * FROM promotions WHERE promotion_id = ?', [result.insertId]);
    return R.created(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function update(req, res) {
  const { promotion_name, discount_rate, promo_type, start_date, end_date } = req.body;
  const fields = []; const params = [];

  if (promotion_name !== undefined) { fields.push('promotion_name = ?'); params.push(promotion_name); }
  if (discount_rate  !== undefined) { fields.push('discount_rate = ?');  params.push(discount_rate); }
  if (promo_type     !== undefined) { fields.push('promo_type = ?');     params.push(promo_type); }
  if (start_date     !== undefined) { fields.push('start_date = ?');     params.push(start_date); }
  if (end_date       !== undefined) { fields.push('end_date = ?');       params.push(end_date); }

  if (!fields.length) return R.badRequest(res, 'No fields to update.');
  params.push(req.params.id);

  try {
    const [result] = await pool.query(
      `UPDATE promotions SET ${fields.join(', ')} WHERE promotion_id = ?`, params
    );
    if (!result.affectedRows) return R.notFound(res, 'Promotion not found.');
    const [rows] = await pool.query('SELECT * FROM promotions WHERE promotion_id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Promotion updated.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function updateStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  try {
    const [result] = await pool.query(
      'UPDATE promotions SET status = ? WHERE promotion_id = ?',
      [req.body.status, req.params.id]
    );
    if (!result.affectedRows) return R.notFound(res, 'Promotion not found.');
    return R.ok(res, { status: req.body.status }, 'Status updated.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

/**
 * POST /api/promotions/apply
 * Body: { promotion_id, order_total }
 * Returns the discount amount to deduct.
 */
async function applyPromotion(req, res) {
  const { promotion_id, order_total } = req.body;
  if (!promotion_id || !order_total) {
    return R.badRequest(res, 'promotion_id and order_total are required.');
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM promotions
       WHERE promotion_id = ?
         AND status = 'Active'
         AND start_date <= CURDATE()
         AND end_date   >= CURDATE()`,
      [promotion_id]
    );
    if (!rows.length) return R.badRequest(res, 'Promotion is not active or not found.');

    const promo = rows[0];
    let discount_amount = 0;

    if (promo.promo_type === 'percentage') {
      discount_amount = parseFloat(((order_total * promo.discount_rate) / 100).toFixed(2));
    } else {
      // fixed amount — cap at order total
      discount_amount = Math.min(parseFloat(promo.discount_rate), parseFloat(order_total));
    }

    return R.ok(res, {
      promotion_id:   promo.promotion_id,
      promotion_name: promo.promotion_name,
      promo_type:     promo.promo_type,
      discount_rate:  promo.discount_rate,
      order_total:    parseFloat(order_total),
      discount_amount,
      final_total:    parseFloat((order_total - discount_amount).toFixed(2)),
    });
  } catch (err) {
    return R.serverError(res, err);
  }
}

module.exports = { list, getActive, getOne, create, update, updateStatus, applyPromotion };