// src/modules/returns/returns.router.js
// ============================================================
//  Returns API routes
// ============================================================
const express = require('express');
const { body, param } = require('express-validator');
const { list, getOne, create, approve, process, complete, reject } = require('./returns.controller');
const auth = require('../../common/middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth.authenticate);

// GET /returns - List all returns
router.get('/', list);

// GET /returns/:id - Get single return
router.get('/:id', param('id').isInt().toInt(), getOne);

// POST /returns - Create return request
router.post(
  '/',
  body('order_id').isInt().toInt().notEmpty(),
  body('sales_channel').isIn(['in_store', 'online', 'dealer', 'marketplace']),
  body('return_type').isIn(['partial', 'full']),
  body('reason').isString().trim().notEmpty().isLength({ max: 500 }),
  create
);

// PATCH /returns/:id/approve - Approve return
router.patch(
  '/:id/approve',
  param('id').isInt().toInt(),
  body('refund_amount').isFloat({ min: 0 }).toFloat(),
  approve
);

// PATCH /returns/:id/process - Process return
router.patch(
  '/:id/process',
  param('id').isInt().toInt(),
  process
);

// PATCH /returns/:id/complete - Complete return
router.patch(
  '/:id/complete',
  param('id').isInt().toInt(),
  complete
);

// PATCH /returns/:id/reject - Reject return
router.patch(
  '/:id/reject',
  param('id').isInt().toInt(),
  body('reason').optional().isString().trim().isLength({ max: 500 }),
  reject
);

module.exports = router;
