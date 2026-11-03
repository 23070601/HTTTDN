// src/modules/auth/auth.router.js
const express   = require('express');
const router    = express.Router();
const { body }  = require('express-validator');
const controller = require('./auth.controller');
const { authenticate } = require('../../common/middleware/auth');

// ────────────────────────────────────────────────────────────
// POST /api/auth/register
// Public customer self-registration
// ────────────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('full_name')
      .notEmpty()
      .withMessage('Full name required'),

    body('email')
      .isEmail()
      .withMessage('Valid email required'),

    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),

    body('phone_number').optional(),

    body('gender')
      .optional()
      .isIn(['Male', 'Female', 'Other']),

    body('city').optional(),
  ],
  controller.register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  controller.login
);

// POST /api/auth/refresh
router.post('/refresh', controller.refresh);

// GET  /api/auth/me
router.get('/me', authenticate, controller.me);

// POST /api/auth/logout
router.post('/logout', authenticate, controller.logout);

module.exports = router;