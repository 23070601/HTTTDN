// src/modules/users/users.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const controller = require('./users.controller');
const { authenticate, authorize } = require('../../common/middleware/auth');

// All user-management routes require admin
router.use(authenticate);

router.get('/',    authorize('admin', 'manager'), controller.list);
router.get('/:id', authorize('admin', 'manager'), controller.getOne);
router.post(
  '/',
  authorize('admin'),
  [
    body('full_name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['sales','warehouse','finance','manager','admin']),
  ],
  controller.create
);
router.put(
  '/:id',
  authorize('admin'),
  [
    body('role').optional().isIn(['sales','warehouse','finance','manager','admin']),
    body('status').optional().isIn(['active','inactive']),
  ],
  controller.update
);
router.delete('/:id', authorize('admin'), controller.remove);

module.exports = router;