// src/modules/products/products.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const controller = require('./products.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

router.use(authenticate);

// Public reads for all authenticated roles
router.get('/',    controller.list);
router.get('/:id', controller.getOne);

// Write operations: manager, admin, warehouse (stock), sales
router.post(
  '/',
  authorize('admin', 'manager'),
  [
    body('category_id').isInt(),
    body('product_name').notEmpty(),
    body('sku').notEmpty(),
    body('selling_price').isFloat({ gt: 0 }),
    body('cost_price').optional().isFloat({ min: 0 }),
  ],
  controller.create
);

router.put('/:id', authorize('admin', 'manager'), controller.update);
router.patch('/:id/status', authorize('admin', 'manager', 'warehouse'), controller.updateStatus);
router.delete('/:id', authorize('admin'), controller.remove);

module.exports = router;