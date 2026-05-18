// src/modules/returns/returns.controller.js
// ============================================================
//  Returns — FIX 1, FIX 6: Separate transaction layer for returns
//  - create: validates delivery status, creates return request
//  - approve: marks return as approved, sets refund amount
//  - process: marks as processing
//  - complete: marks as completed, triggers inventory adjustment
// ============================================================
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

const RETURN_TYPES = new Set(['partial', 'full']);
const RETURN_STATUSES = new Set(['pending', 'approved', 'processing', 'completed', 'rejected']);

const CHANNEL_RETURN_RULES = {
  in_store: {
    allowReturn: true,
    windowDays: 7,
    requiresPhysicalItem: true,
    requiresReceipt: true
  },
  online: {
    allowReturn: true,
    windowDays: 14,
    requiresPhysicalItem: true,
    requiresReceipt: false
  },
  dealer: {
    allowReturn: true,
    windowDays: 30,
    requiresPhysicalItem: false,
    requiresReceipt: true
  },
  marketplace: {
    allowReturn: false,
    note: 'Returns handled by platform'
  }
};

async function logReturnAudit(conn, { userId, action, riskLevel = 'Normal', details }) {
  await conn.query(
    `INSERT INTO audit_logs (user_id, action, module, risk_level, details)
     VALUES (?, ?, 'Returns', ?, ?)`,
    [userId || null, action, riskLevel, details]
  );
}

function buildReturnChangeDetails(returnId, changes) {
  return JSON.stringify({
    return_id: returnId,
    changes,
  });
}

// ─── LIST RETURNS ─────────────────────────────────────────────
async function list(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { order_id, status, return_type, sales_channel } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (order_id) { where += ' AND rr.order_id = ?'; params.push(order_id); }
  if (status) { where += ' AND rr.status = ?'; params.push(status); }
  if (return_type) { where += ' AND rr.return_type = ?'; params.push(return_type); }
  if (sales_channel) { where += ' AND rr.sales_channel = ?'; params.push(sales_channel); }

  try {
    const [rows] = await pool.query(
      `SELECT rr.*, o.order_number, o.total_amount, c.full_name as customer_name
       FROM return_requests rr
       JOIN orders o ON o.order_id = rr.order_id
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       ${where}
       ORDER BY rr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM return_requests rr ${where}`,
      params
    );

    return R.ok(res, { data: rows, pagination: { page, limit, total } });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ─── GET ONE RETURN ────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const [[row]] = await pool.query(
      `SELECT rr.*, o.order_number, o.total_amount, c.full_name as customer_name
       FROM return_requests rr
       JOIN orders o ON o.order_id = rr.order_id
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       WHERE rr.return_id = ?`,
      [req.params.id]
    );
    if (!row) return R.notFound(res, 'Return request not found.');

    const [items] = await pool.query(
      `SELECT oi.*, p.product_name, p.sku FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [row.order_id]
    );

    return R.ok(res, { ...row, order_items: items });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ─── CREATE RETURN REQUEST ────────────────────────────────────
async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { order_id, sales_channel, return_type, reason } = req.body;

    // FIX 6: Validate delivery status MUST be Delivered
    const [[order]] = await conn.query(
      'SELECT delivery_status, customer_type FROM orders WHERE order_id = ?',
      [order_id]
    );

    if (!order) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Order not found.');
    }

    if (order.delivery_status !== 'Delivered') {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Returns only allowed for Delivered orders.');
    }

    if (!RETURN_TYPES.has(return_type)) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Invalid return_type. Must be one of: ${Array.from(RETURN_TYPES).join(', ')}`);
    }

    // Validate sales_channel return rules
    const channelRule = CHANNEL_RETURN_RULES[sales_channel];
    if (!channelRule) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Invalid sales_channel: ${sales_channel}`);
    }

    if (!channelRule.allowReturn) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Returns not allowed for ${sales_channel} channel. ${channelRule.note}`);
    }

    // Validate return window (days since order delivery)
    if (channelRule.windowDays) {
      const [[orderTimestamp]] = await conn.query(
        'SELECT ordered_at FROM orders WHERE order_id = ?',
        [order_id]
      );
      const daysSinceOrder = Math.floor((Date.now() - new Date(orderTimestamp.ordered_at)) / (1000 * 60 * 60 * 24));
      if (daysSinceOrder > channelRule.windowDays) {
        await conn.rollback();
        conn.release();
        return R.badRequest(res, `Return window expired. ${sales_channel} returns only allowed within ${channelRule.windowDays} days.`);
      }
    }

    // FIX 6: Never edit original order, never recreate, never change to Return status
    const [returnResult] = await conn.query(
      `INSERT INTO return_requests (order_id, sales_channel, return_type, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [order_id, sales_channel, return_type, reason]
    );

    const returnId = returnResult.insertId;

    await logReturnAudit(conn, {
      userId: req.user.user_id,
      action: `Return request created: ${returnId}`,
      riskLevel: 'Normal',
      details: buildReturnChangeDetails(returnId, [
        { field: 'status', from: 'none', to: 'pending' },
        { field: 'return_type', from: 'none', to: return_type },
      ]),
    });

    await conn.commit();
    conn.release();

    const [rows] = await pool.query(
      `SELECT rr.*, o.order_number FROM return_requests rr
       JOIN orders o ON o.order_id = rr.order_id
       WHERE rr.return_id = ?`,
      [returnId]
    );

    return R.created(res, rows[0], 'Return request created successfully.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// ─── APPROVE RETURN ───────────────────────────────────────────
async function approve(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { refund_amount } = req.body;
    const [[returnRequest]] = await conn.query(
      'SELECT * FROM return_requests WHERE return_id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!returnRequest) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Return request not found.');
    }

    if (returnRequest.status !== 'pending') {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Cannot approve return with status: ${returnRequest.status}`);
    }

    // Validate refund_amount
    const [[order]] = await conn.query('SELECT total_amount FROM orders WHERE order_id = ?', [returnRequest.order_id]);
    if (parseFloat(refund_amount) > parseFloat(order.total_amount)) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Refund amount cannot exceed order total (${order.total_amount}).`);
    }

    await conn.query(
      `UPDATE return_requests SET status = 'approved', refund_amount = ?, approved_at = NOW(), updated_at = NOW()
       WHERE return_id = ?`,
      [refund_amount, req.params.id]
    );

    await logReturnAudit(conn, {
      userId: req.user.user_id,
      action: `Return approved: ${req.params.id}`,
      riskLevel: 'Normal',
      details: buildReturnChangeDetails(req.params.id, [
        { field: 'status', from: 'pending', to: 'approved' },
        { field: 'refund_amount', from: null, to: refund_amount },
      ]),
    });

    await conn.commit();
    conn.release();

    const [[updated]] = await pool.query('SELECT * FROM return_requests WHERE return_id = ?', [req.params.id]);
    return R.ok(res, updated, 'Return approved.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// ─── PROCESS RETURN ───────────────────────────────────────────
async function process(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[returnRequest]] = await conn.query(
      'SELECT * FROM return_requests WHERE return_id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!returnRequest) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Return request not found.');
    }

    if (returnRequest.status !== 'approved') {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Can only process approved returns. Current status: ${returnRequest.status}`);
    }

    await conn.query(
      `UPDATE return_requests SET status = 'processing', updated_at = NOW()
       WHERE return_id = ?`,
      [req.params.id]
    );

    await logReturnAudit(conn, {
      userId: req.user.user_id,
      action: `Return processing: ${req.params.id}`,
      riskLevel: 'Normal',
      details: buildReturnChangeDetails(req.params.id, [
        { field: 'status', from: 'approved', to: 'processing' },
      ]),
    });

    await conn.commit();
    conn.release();

    const [[updated]] = await pool.query('SELECT * FROM return_requests WHERE return_id = ?', [req.params.id]);
    return R.ok(res, updated, 'Return processing.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// ─── COMPLETE RETURN ──────────────────────────────────────────
async function complete(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[returnRequest]] = await conn.query(
      'SELECT * FROM return_requests WHERE return_id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!returnRequest) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Return request not found.');
    }

    if (returnRequest.status !== 'processing') {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Can only complete processing returns. Current status: ${returnRequest.status}`);
    }

    // Complete the return
    await conn.query(
      `UPDATE return_requests SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE return_id = ?`,
      [req.params.id]
    );

    // Trigger inventory adjustment for returned items (creates stock-in transactions)
    const [orderItems] = await conn.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [returnRequest.order_id]
    );

    for (const item of orderItems) {
      if (returnRequest.return_type === 'full' || returnRequest.return_type === 'partial') {
        // Create stock transaction for return
        await conn.query(
          `INSERT INTO stock_transactions (product_id, user_id, transaction_type, quantity, warehouse, reference_id, note, created_at)
           VALUES (?, ?, 'Stock In', ?, 'HCM Warehouse', ?, ?, NOW())`,
          [item.product_id, req.user.user_id, item.quantity, `RR-${req.params.id}`, `Return request ${req.params.id}`]
        );
      }
    }

    await logReturnAudit(conn, {
      userId: req.user.user_id,
      action: `Return completed: ${req.params.id}`,
      riskLevel: 'High',
      details: buildReturnChangeDetails(req.params.id, [
        { field: 'status', from: 'processing', to: 'completed' },
        { field: 'refund_processed', from: false, to: true },
      ]),
    });

    await conn.commit();
    conn.release();

    const [[updated]] = await pool.query('SELECT * FROM return_requests WHERE return_id = ?', [req.params.id]);
    return R.ok(res, updated, 'Return completed and inventory adjusted.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// ─── REJECT RETURN ────────────────────────────────────────────
async function reject(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { reason } = req.body;
    const [[returnRequest]] = await conn.query(
      'SELECT * FROM return_requests WHERE return_id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!returnRequest) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Return request not found.');
    }

    if (returnRequest.status !== 'pending') {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Cannot reject return with status: ${returnRequest.status}`);
    }

    await conn.query(
      `UPDATE return_requests SET status = 'rejected', note = ?, updated_at = NOW()
       WHERE return_id = ?`,
      [reason || null, req.params.id]
    );

    await logReturnAudit(conn, {
      userId: req.user.user_id,
      action: `Return rejected: ${req.params.id}`,
      riskLevel: 'Normal',
      details: buildReturnChangeDetails(req.params.id, [
        { field: 'status', from: 'pending', to: 'rejected' },
        { field: 'rejection_reason', from: null, to: reason },
      ]),
    });

    await conn.commit();
    conn.release();

    const [[updated]] = await pool.query('SELECT * FROM return_requests WHERE return_id = ?', [req.params.id]);
    return R.ok(res, updated, 'Return rejected.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

module.exports = { list, getOne, create, approve, process, complete, reject };
