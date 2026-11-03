// src/modules/analytics/analytics.router.js

const express = require('express');
const router = express.Router();

const controller = require('./analytics.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

router.use(
  authenticate,
  authorize('admin', 'manager', 'finance')
);

// ─────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────
router.get('/dashboard', controller.dashboard);

// ─────────────────────────────────────────
// Revenue Analytics
// ─────────────────────────────────────────
router.get('/revenue/monthly', controller.revenueMonthly);
router.get('/revenue/by-channel', controller.revenueByChannel);
router.get('/revenue/by-product', controller.revenueByProduct);

// ─────────────────────────────────────────
// Customer Analytics
// ─────────────────────────────────────────
router.get('/customers/segments', controller.customerSegments);
router.get('/customers/rfm', controller.rfmAnalysis);
router.get('/customers/top', controller.topCustomers);

// ─────────────────────────────────────────
// Inventory Analytics
// ─────────────────────────────────────────

// Summary card
router.get(
  '/inventory/summary',
  controller.lowStockSummary
);

// Product list for dashboard table
router.get(
  '/inventory/low-stock',
  controller.lowStockProducts
);

// ─────────────────────────────────────────
// Audit Logs
// ─────────────────────────────────────────
router.get('/audit-logs', controller.auditLogs);

module.exports = router;