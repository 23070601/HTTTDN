// src/index.js
// ============================================================
//  Cocoon Vietnam — Sales Management System
//  Backend REST API  |  Express + MySQL
// ============================================================
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const { testConnection } = require('./config/db');

// ─── Route modules ──────────────────────────────────────────
const authRouter         = require('./modules/auth/auth.router');
const usersRouter        = require('./modules/users/users.router');
const categoriesRouter   = require('./modules/categories/categories.router');
const productsRouter     = require('./modules/products/products.router');
const ordersRouter       = require('./modules/orders/orders.router');
const customersRouter    = require('./modules/customers/customers.router');
const inventoryRouter    = require('./modules/inventory/inventory.router');
const rawMaterialsRouter = require('./modules/raw-materials/raw-materials.router');
const dealersRouter      = require('./modules/dealers/dealers.router');
const promotionsRouter   = require('./modules/promotions/promotions.router');
const analyticsRouter    = require('./modules/analytics/analytics.router');
<<<<<<< HEAD
const returnsRouter      = require('./modules/returns/returns.router');
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security & parsing ─────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Rate limiting ──────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '100'),
  message:  { success: false, message: 'Too many requests, please try again later.' },
});
<<<<<<< HEAD
// Stricter limit on auth endpoints — don't count successful requests (e.g. polling)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true });
=======
// Stricter limit on auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f

app.use('/api/auth', authLimiter);
app.use('/api', limiter);

// ─── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Cocoon SMS API' });
});

// ─── API routes ──────────────────────────────────────────────
const API = '/api';
app.use(`${API}/auth`,          authRouter);
app.use(`${API}/users`,         usersRouter);
app.use(`${API}/categories`,    categoriesRouter);
app.use(`${API}/products`,      productsRouter);
app.use(`${API}/orders`,        ordersRouter);
<<<<<<< HEAD
app.use(`${API}/returns`,       returnsRouter);
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
app.use(`${API}/customers`,     customersRouter);
app.use(`${API}/inventory`,     inventoryRouter);
app.use(`${API}/raw-materials`, rawMaterialsRouter);
app.use(`${API}/dealers`,       dealersRouter);
app.use(`${API}/promotions`,    promotionsRouter);
app.use(`${API}/analytics`,     analyticsRouter);

// ─── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global error handler ───────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start ───────────────────────────────────────────────────
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀  Cocoon SMS API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`📋  Routes:`);
    console.log(`    POST   ${API}/auth/login`);
    console.log(`    GET    ${API}/auth/me`);
    console.log(`    GET    ${API}/products?search=&category_id=&status=&page=&limit=`);
    console.log(`    POST   ${API}/orders`);
    console.log(`    PATCH  ${API}/orders/:id/delivery-status`);
    console.log(`    GET    ${API}/analytics/dashboard`);
    console.log(`    GET    ${API}/inventory/alerts`);
    console.log(`    GET    ${API}/analytics/audit-logs`);
  });
}

start();