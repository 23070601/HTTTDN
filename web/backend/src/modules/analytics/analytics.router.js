// src/modules/analytics/analytics.router.js
const express    = require('express');
const router     = express.Router();
const controller = require('./analytics.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

router.use(authenticate, authorize('admin', 'manager', 'finance'));

// General dashboard KPIs
router.get('/dashboard',         controller.dashboard);

// Revenue breakdown
router.get('/revenue/monthly',   controller.revenueMonthly);
router.get('/revenue/by-channel', controller.revenueByChannel);
router.get('/revenue/by-product', controller.revenueByProduct);

// Customer analytics
router.get('/customers/segments',   controller.customerSegments);
router.get('/customers/rfm',        controller.rfmAnalysis);
router.get('/customers/top',        controller.topCustomers);

// Inventory analytics
router.get('/inventory/low-stock',  controller.lowStockSummary);

// Audit logs
router.get('/audit-logs',           controller.auditLogs);

module.exports = router;