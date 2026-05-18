const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

async function list(req, res) {
  try {
    const [rows] = await pool.query('SELECT user_id, full_name, email, role, status, office, last_login_at, created_at FROM users');
    return R.ok(res, rows);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getOne(req, res) {
  try {
    const [rows] = await pool.query('SELECT user_id, full_name, email, role, status, office, last_login_at, created_at FROM users WHERE user_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'User not found');
    return R.ok(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function create(req, res) {
  const { full_name, email, password, role, office, status } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, office, status) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, email, password_hash, role || 'staff', office, status || 'active']
    );
    return R.ok(res, { user_id: result.insertId }, 'User created successfully');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function update(req, res) {
<<<<<<< HEAD
  const allowedFields = [
    'full_name',
    'email',
    'role',
    'office',
    'status'
  ];

  const fields = [];
  const values = [];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  if (fields.length === 0) {
    return R.badRequest(res, 'No fields to update');
  }

  values.push(req.params.id);

  try {
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );

=======
  const { full_name, email, role, office, status } = req.body;
  try {
    await pool.query(
      'UPDATE users SET full_name = ?, email = ?, role = ?, office = ?, status = ? WHERE user_id = ?',
      [full_name, email, role, office, status, req.params.id]
    );
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    return R.ok(res, null, 'User updated successfully');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function remove(req, res) {
  try {
<<<<<<< HEAD
    await pool.query(
      'UPDATE users SET status = ? WHERE user_id = ?',
      ['inactive', req.params.id]
    );

    return R.ok(res, null, 'User deactivated successfully');
=======
    await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    return R.ok(res, null, 'User deleted successfully');
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
  } catch (err) {
    return R.serverError(res, err);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove
};
