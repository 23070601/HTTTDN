// src/modules/dealers/dealers.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const controller = require('./dealers.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

router.use(authenticate);

router.get('/',    controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/debt-history', controller.getDebtHistory);
router.get('/:id/orders', controller.getOrders);
router.get('/:id/invoices', controller.getDebtHistory);

router.post(
  '/',
  authorize('admin', 'manager', 'finance'),
  [
    body('dealer_name').notEmpty(),
    body('credit_limit').isFloat({ min: 0 }),
    body('wholesale_tier').optional().isString(),
    body('payment_terms').optional().isString(),
  ],
  controller.create
);

router.put('/:id', authorize('admin', 'manager', 'finance'), controller.update);

// Record a debt transaction: Invoice | Payment Received | etc.
router.post(
  '/:id/debt-transaction',
  authorize('finance', 'admin', 'manager'),
  [
    body('transaction_type').isIn(['Invoice','Payment Received','Credit Approved','Adjustment','Refund']),
    body('amount').isFloat({ gt: 0 }),
    body('note').optional(),
  ],
  controller.addDebtTransaction
);

module.exports = router;