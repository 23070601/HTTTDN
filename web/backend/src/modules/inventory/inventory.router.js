// src/modules/inventory/inventory.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const controller = require('./inventory.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

router.use(authenticate);

// Stock transaction history
router.get('/transactions', controller.listTransactions);

// Stock adjustment (warehouse, admin, manager)
router.post(
  '/stock-in',
  authorize('warehouse', 'admin', 'manager'),
  [
    body('product_id').isInt({ gt: 0 }),
    body('quantity').isInt({ gt: 0 }),
    body('warehouse').optional(),
    body('reference_id').optional(),
    body('note').optional(),
  ],
  controller.stockIn
);

router.post(
  '/adjustment',
  authorize('warehouse', 'admin', 'manager'),
  [
    body('product_id').isInt({ gt: 0 }),
    body('quantity').isInt({ gt: 0 }),
    body('new_quantity').isInt({ min: 0 }),
    body('note').notEmpty(),
  ],
  controller.adjustment
);

// Inventory alerts (low stock)
router.get('/alerts', authorize('admin', 'manager', 'warehouse'), controller.getAlerts);

module.exports = router;