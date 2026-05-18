// src/modules/categories/categories.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const { pool }   = require('../../config/db');
const R = require('../../common/utils/response');
const { authenticate, authorize } = require('../../common/middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY category_name');
    return R.ok(res, rows);
  } catch (err) { return R.serverError(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE category_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Category not found.');
    return R.ok(res, rows[0]);
  } catch (err) { return R.serverError(res, err); }
});

router.post(
  '/',
  authorize('admin', 'manager'),
  [body('category_name').notEmpty()],
  async (req, res) => {
    const { category_name, description } = req.body;
    try {
      const [result] = await pool.query('INSERT INTO categories (category_name, description) VALUES (?, ?)', [category_name, description || null]);
      const [rows] = await pool.query('SELECT * FROM categories WHERE category_id = ?', [result.insertId]);
      return R.created(res, rows[0]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Category name already exists.');
      return R.serverError(res, err);
    }
  }
);

router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  const { category_name, description } = req.body;
  try {
    await pool.query('UPDATE categories SET category_name = COALESCE(?, category_name), description = COALESCE(?, description) WHERE category_id = ?',
      [category_name || null, description || null, req.params.id]);
    const [rows] = await pool.query('SELECT * FROM categories WHERE category_id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Category updated.');
  } catch (err) { return R.serverError(res, err); }
});

module.exports = router;