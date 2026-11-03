// src/modules/auth/auth.controller.js
const { validationResult } = require('express-validator');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const jwtCfg  = require('../../config/jwt');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');

// ────────────────────────────────────────────────────────────
//  POST /api/auth/login
// ────────────────────────────────────────────────────────────
async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT user_id, customer_id, full_name, email, password_hash, role, status, office FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) return R.unauthorized(res, 'Invalid credentials.');

    const user = rows[0];
    if (user.status === 'inactive') return R.forbidden(res, 'Account is deactivated.');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return R.unauthorized(res, 'Invalid credentials.');

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

    const payload = {
      user_id:   user.user_id,
      customer_id: user.customer_id,
      email:     user.email,
      role:      user.role,
      full_name: user.full_name,
    };

    const access_token  = jwt.sign(payload, jwtCfg.secret,        { expiresIn: jwtCfg.expiresIn });
    const refresh_token = jwt.sign(payload, jwtCfg.refreshSecret, { expiresIn: jwtCfg.refreshExpires });

    // Audit log
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, risk_level, details) VALUES (?, 'User login', 'Security', 'Normal', ?)",
      [user.user_id, `email=${user.email} | role=${user.role}`]
    );

    return R.ok(res, {
      access_token,
      refresh_token,
      user: { user_id: user.user_id, customer_id: user.customer_id, full_name: user.full_name, email: user.email, role: user.role, office: user.office },
    }, 'Login successful');

  } catch (err) {
    return R.serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────────
//  POST /api/auth/refresh
// ────────────────────────────────────────────────────────────
async function refresh(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) return R.badRequest(res, 'Refresh token required.');

  try {
    const decoded = jwt.verify(refresh_token, jwtCfg.refreshSecret);
    const payload = { user_id: decoded.user_id, email: decoded.email, role: decoded.role, full_name: decoded.full_name };
    const access_token = jwt.sign(payload, jwtCfg.secret, { expiresIn: jwtCfg.expiresIn });
    return R.ok(res, { access_token });
  } catch {
    return R.unauthorized(res, 'Invalid or expired refresh token.');
  }
}

// ────────────────────────────────────────────────────────────
//  GET /api/auth/me
// ────────────────────────────────────────────────────────────
async function me(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, customer_id, full_name, email, role, status, office, last_login_at, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!rows.length) return R.notFound(res, 'User not found.');
    return R.ok(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────────
//  POST /api/auth/logout   (audit trail)
// ────────────────────────────────────────────────────────────
async function logout(req, res) {
  try {
    await pool.query(
      "INSERT INTO audit_logs (user_id, action, module, risk_level, details) VALUES (?, 'User logout', 'Security', 'Normal', ?)",
      [req.user.user_id, `email=${req.user.email}`]
    );
    return R.ok(res, null, 'Logged out successfully.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return R.badRequest(res, 'Validation failed', errors.array());
  }

  const { full_name, email, password, phone_number, gender, city } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Check duplicate
    const [[dup]] = await conn.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (dup) {
      await conn.rollback();
      return R.conflict(res, 'Email already registered.');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create customer
    const [custResult] = await conn.query(
      `INSERT INTO customers
       (full_name, email, phone_number, customer_type, gender, city)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email,
        phone_number || null,
        'retail',
        gender || null,
        city || null
      ]
    );

    const customer_id = custResult.insertId;

    // Create user
    const [userResult] = await conn.query(
      `INSERT INTO users
       (full_name, email, password_hash, role, status, customer_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email,
        password_hash,
        'customer',
        'active',
        customer_id
      ]
    );

    const user_id = userResult.insertId;

    await conn.commit();

    // JWT
    const payload = {
      user_id,
      customer_id,
      email,
      role: 'customer',
      full_name
    };

    const access_token = jwt.sign(payload, jwtCfg.secret, {
      expiresIn: jwtCfg.expiresIn
    });

    const refresh_token = jwt.sign(payload, jwtCfg.refreshSecret, {
      expiresIn: jwtCfg.refreshExpires
    });

    return R.created(res, {
      access_token,
      refresh_token,
      user: {
        user_id,
        customer_id,
        full_name,
        email,
        role: 'customer'
      }
    }, 'Register successful');

  } catch (err) {

  await conn.rollback();

  // Duplicate email
  if (err.code === 'ER_DUP_ENTRY') {
    return R.conflict(
      res,
      'Email đã được đăng ký. Vui lòng dùng email khác.'
    );
  }

  return R.serverError(res, err);
} finally {
    conn.release();
  }
}

module.exports = { login, register, refresh, me, logout };