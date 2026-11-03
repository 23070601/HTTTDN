// src/modules/orders/orders.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const controller = require('./orders.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

// ──────────────────────────────────────────────────────────────
// PUBLIC STOREFRONT ROUTES  (no token required — placed BEFORE authenticate)
// ──────────────────────────────────────────────────────────────

// POST /api/orders/guest — Storefront checkout (guest + registered customer)
router.post(
  '/guest',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.product_id').isInt({ gt: 0 }),
    body('items.*.quantity').isInt({ gt: 0 }),
    body('payment_method').notEmpty().isIn(['COD', 'Bank Transfer', 'Card', 'Momo', 'VNPay'])
      .withMessage('Invalid payment method for online channel'),
    body('shipping_address').notEmpty().withMessage('Shipping address required'),
    // Registered customer path
    body('customer_id').optional().isInt({ gt: 0 }),
    // Guest path
    body('customer_name').optional().isString(),
    body('customer_email').optional().isEmail(),
    body('customer_phone').optional().isString(),
    // Optional
    body('city').optional().isString(),
    body('shipping_fee').optional().isFloat({ min: 0 }),
    body('loyalty_points_used').optional().isInt({ min: 0 }),
    body('note').optional().isString(),
  ],
  controller.createGuestOrder
);

// POST /api/orders/track — Public order tracking by order_number + email OR phone
router.post('/track', controller.trackOrder);

router.use(authenticate);

router.get('/',    controller.list);
router.get('/:id', controller.getOne);

// Create order: sales, admin, manager
router.post(
  '/',
  authorize('sales', 'admin', 'manager'),
  [
    body('customer_type').optional().isIn(['retail','dealer','guest','marketplace']),
    body('customer_id').optional().isInt({ gt: 0 }),
    body('dealer_id').optional().isInt({ gt: 0 }),
    body('customer_name').optional().isString(),
    body('customer_email').optional().isEmail(),
    body('customer_phone').optional().isString(),
    body('sales_channel').isIn(['in_store','online','dealer']),
    body('platform').optional().isIn(['website','physical_store','dealer_portal']),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.product_id').isInt({ gt: 0 }),
    body('items.*.quantity').isInt({ gt: 0 }),
    body('payment_method').optional().isString(),
    body('payment_confirmed').optional().isBoolean(),
    body('shipping_address').optional().isString(),
    body('loyalty_discount').optional().isFloat({ min: 0 }),
    body('shipping_fee').optional().isFloat({ min: 0 }),
  ],
  controller.create
);

// Update order before shipping or limited after shipping
router.patch(
  '/:id',
  authorize('sales', 'admin', 'manager'),
  [
    body('customer_id').optional().isInt({ gt: 0 }),
    body('customer_name').optional().isString(),
    body('customer_email').optional().isEmail(),
    body('customer_phone').optional().isString(),
    body('shipping_address').optional().isString(),
    body('city').optional().isString(),
    body('payment_method').optional().isString(),
    body('payment_confirmed').optional().isBoolean(),
    body('note').optional().isString(),
    body('tracking_code').optional().isString(),
    body('shipping_carrier').optional().isString(),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.product_id').optional().isInt({ gt: 0 }),
    body('items.*.quantity').optional().isInt({ gt: 0 }),
  ],
  controller.update
);

// Cancel or delete order depending on lifecycle state
router.delete(
  '/:id',
  authorize('sales', 'admin', 'manager'),
  controller.remove
);

// Update delivery status
router.patch(
  '/:id/delivery-status',
  authorize('sales', 'admin', 'manager', 'warehouse'),
  [body('delivery_status').isIn(['Pending','Confirmed','Processing','Shipping','Delivered','Cancelled'])],
  controller.updateDeliveryStatus
);

// Update payment status
router.patch(
  '/:id/payment-status',
  authorize('finance', 'admin', 'manager'),
  [body('payment_status').isIn(['Unpaid','Paid','Refunded'])],
  controller.updatePaymentStatus
);

// Order items for a specific order
router.get('/:id/items', controller.getItems);

module.exports = router;