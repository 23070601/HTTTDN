// src/modules/dealers/dealers.controller.js
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

async function list(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { debt_status, partner_status, region, wholesale_tier, search } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (debt_status)    { where += ' AND debt_status = ?';    params.push(debt_status); }
  if (partner_status) { where += ' AND partner_status = ?'; params.push(partner_status); }
  if (region)         { where += ' AND region = ?';         params.push(region); }
  if (wholesale_tier) { where += ' AND wholesale_tier = ?'; params.push(wholesale_tier); }
  if (search)         {
    where += ' AND (dealer_name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR phone_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM dealers ${where}`, params);
    const [rows] = await pool.query(
      `SELECT *, debt_amount AS outstanding_debt FROM dealers ${where} ORDER BY dealer_name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getOne(req, res) {
  try {
    const [rows] = await pool.query('SELECT *, debt_amount AS outstanding_debt FROM dealers WHERE dealer_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Dealer not found.');
    return R.ok(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const { dealer_name, region, city, contact_person, phone_number, email, wholesale_tier = 'Tier 1', payment_terms = 'Net 30', credit_limit = 0 } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO dealers (dealer_name, region, city, contact_person, phone_number, email, wholesale_tier, payment_terms, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [dealer_name, region || null, city || null, contact_person || null, phone_number || null, email || null, wholesale_tier, payment_terms, credit_limit]
    );
    const [rows] = await pool.query('SELECT *, debt_amount AS outstanding_debt FROM dealers WHERE dealer_id = ?', [result.insertId]);
    return R.created(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function update(req, res) {
  const { dealer_name, region, city, contact_person, phone_number, email, wholesale_tier, payment_terms, credit_limit, partner_status } = req.body;
  const fields = []; const params = [];

  if (dealer_name    !== undefined) { fields.push('dealer_name = ?');    params.push(dealer_name); }
  if (region         !== undefined) { fields.push('region = ?');         params.push(region); }
  if (city           !== undefined) { fields.push('city = ?');           params.push(city); }
  if (contact_person !== undefined) { fields.push('contact_person = ?'); params.push(contact_person); }
  if (phone_number   !== undefined) { fields.push('phone_number = ?');   params.push(phone_number); }
  if (email          !== undefined) { fields.push('email = ?');          params.push(email); }
  if (wholesale_tier !== undefined) { fields.push('wholesale_tier = ?'); params.push(wholesale_tier); }
  if (payment_terms  !== undefined) { fields.push('payment_terms = ?');  params.push(payment_terms); }
  if (credit_limit   !== undefined) { fields.push('credit_limit = ?');   params.push(credit_limit); }
  if (partner_status !== undefined) { fields.push('partner_status = ?'); params.push(partner_status); }

  if (!fields.length) return R.badRequest(res, 'No fields to update.');
  params.push(req.params.id);

  try {
    const [result] = await pool.query(`UPDATE dealers SET ${fields.join(', ')}, updated_at = NOW() WHERE dealer_id = ?`, params);
    if (!result.affectedRows) return R.notFound(res, 'Dealer not found.');
    const [rows] = await pool.query('SELECT *, debt_amount AS outstanding_debt FROM dealers WHERE dealer_id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Dealer updated.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getOrders(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  try {
    const [exists] = await pool.query('SELECT dealer_id FROM dealers WHERE dealer_id = ?', [req.params.id]);
    if (!exists.length) return R.notFound(res, 'Dealer not found.');

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM orders WHERE dealer_id = ?', [req.params.id]
    );
    const [rows] = await pool.query(
      `SELECT o.*, c.full_name AS customer_name, c.phone_number AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       WHERE o.dealer_id = ?
       ORDER BY o.ordered_at DESC LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getDebtHistory(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  try {
    const [exists] = await pool.query('SELECT dealer_id FROM dealers WHERE dealer_id = ?', [req.params.id]);
    if (!exists.length) return R.notFound(res, 'Dealer not found.');

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM debt_transactions WHERE dealer_id = ?', [req.params.id]
    );
    const [rows] = await pool.query(
      `SELECT dt.*, u.full_name AS staff_name
       FROM debt_transactions dt JOIN users u ON u.user_id = dt.user_id
       WHERE dt.dealer_id = ? ORDER BY dt.created_at DESC LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// POST /dealers/:id/debt-transaction
// trg_dealer_debt_balance fires automatically to update debt_amount and debt_status
async function addDebtTransaction(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const { transaction_type, amount, note = null } = req.body;
  try {
    const [exists] = await pool.query('SELECT dealer_id, credit_limit, debt_amount FROM dealers WHERE dealer_id = ?', [req.params.id]);
    if (!exists.length) return R.notFound(res, 'Dealer not found.');

    // Warn if payment would make debt negative
    if (transaction_type === 'Payment Received' && amount > exists[0].debt_amount) {
      return R.badRequest(res, `Payment (${amount}) exceeds current debt (${exists[0].debt_amount}).`);
    }

    await pool.query(
      "INSERT INTO debt_transactions (dealer_id, user_id, transaction_type, amount, note) VALUES (?, ?, ?, ?, ?)",
      [req.params.id, req.user.user_id, transaction_type, amount, note]
    );
    // Trigger updates dealers.debt_amount + dealers.debt_status + audit_logs automatically

    const [[updated]] = await pool.query('SELECT dealer_id, debt_amount, debt_status, total_revenue FROM dealers WHERE dealer_id = ?', [req.params.id]);
    return R.created(res, updated, 'Debt transaction recorded.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

module.exports = { list, getOne, create, update, getDebtHistory, addDebtTransaction, getOrders };
