// src/modules/auth/auth.router.js
const express   = require('express');
const router    = express.Router();
const { body }  = require('express-validator');
const controller = require('./auth.controller');
const { authenticate } = require('../../common/middleware/auth');

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