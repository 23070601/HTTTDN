// src/modules/customers/customers.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const controller = require('./customers.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

<<<<<<< HEAD
// Public debug endpoints (no auth required) - MUST be before authenticate middleware
router.get('/test/all', async (req, res) => {
  try {
    const { pool } = require('../../config/db');
    const [rows] = await pool.query('SELECT customer_id, full_name, phone_number, email FROM customers LIMIT 10');
    res.json({ success: true, message: 'Sample customers from DB', count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/test/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: false, message: 'Query parameter q is required' });
    
    const { pool } = require('../../config/db');
    const searchTerm = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT customer_id, full_name, phone_number, email FROM customers WHERE phone_number LIKE ? OR full_name LIKE ? LIMIT 20`,
      [searchTerm, searchTerm]
    );
    res.json({ success: true, query: q, found: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Authenticate middleware - applies to all routes below
router.use(authenticate);

router.get('/',    controller.list);
router.get('/search', controller.search);
router.get('/:id/orders',      controller.getOrders);
router.get('/:id/loyalty',     controller.getLoyaltyHistory);
router.get('/:id', controller.getOne);
=======
router.use(authenticate);

router.get('/',    controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/orders',      controller.getOrders);
router.get('/:id/loyalty',     controller.getLoyaltyHistory);
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f

router.post(
  '/',
  authorize('sales', 'admin', 'manager'),
  [
    body('full_name').notEmpty(),
    body('email').isEmail(),
    body('phone_number').optional(),
<<<<<<< HEAD
    body('customer_type').optional().isIn(['retail','dealer','guest','marketplace']),
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    body('segment').optional().isIn(['New','Loyal','VIP','Whale','At-risk','Wholesale']),
  ],
  controller.create
);

router.put('/:id', authorize('sales', 'admin', 'manager'), controller.update);

// Redeem loyalty points
router.post(
  '/:id/redeem-points',
  authorize('sales', 'admin', 'manager'),
  [body('points').isInt({ gt: 0 }), body('order_id').optional().isInt()],
  controller.redeemPoints
);

module.exports = router;