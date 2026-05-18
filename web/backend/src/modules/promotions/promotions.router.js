// src/modules/promotions/promotions.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const controller = require('./promotions.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

router.use(authenticate);

router.get('/',    controller.list);
router.get('/active', controller.getActive);
router.get('/:id', controller.getOne);

router.post(
  '/',
  authorize('admin', 'manager'),
  [
    body('promotion_name').notEmpty(),
    body('discount_rate').isFloat({ min: 0, max: 100 }),
    body('promo_type').isIn(['percentage', 'fixed']),
    body('start_date').isDate(),
    body('end_date').isDate(),
  ],
  controller.create
);

router.put('/:id', authorize('admin', 'manager'), controller.update);

router.patch(
  '/:id/status',
  authorize('admin', 'manager'),
  [body('status').isIn(['Active', 'Inactive', 'Expired'])],
  controller.updateStatus
);

// Apply promotion to an order (calculate discount amount)
router.post('/apply', authenticate, controller.applyPromotion);

module.exports = router;