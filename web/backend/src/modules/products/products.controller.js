// src/modules/products/products.controller.js
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

async function list(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { category_id, status, visibility, search, sort = 'created_at', order = 'DESC' } = req.query;

  const ALLOWED_SORT = ['product_name', 'selling_price', 'stock_quantity', 'sold_count', 'created_at'];
  const sortCol  = ALLOWED_SORT.includes(sort) ? sort : 'created_at';
  const sortDir  = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let where = 'WHERE 1=1';
  const params = [];
  if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
  if (status)      { where += ' AND p.status = ?';      params.push(status); }
  if (visibility)  { where += ' AND p.visibility = ?';  params.push(visibility); }
  if (search)      {
    where += ' AND (p.product_name LIKE ? OR p.sku LIKE ? OR p.tags LIKE ? OR p.ingredients LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT p.*, c.category_name
       FROM products p
       LEFT JOIN categories c ON c.category_id = p.category_id
       ${where}
       ORDER BY p.${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function getOne(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.category_name
       FROM products p
       LEFT JOIN categories c ON c.category_id = p.category_id
       WHERE p.product_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return R.notFound(res, 'Product not found.');
    return R.ok(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const {
    category_id, product_name, sku, cost_price = 0,
    selling_price, stock_quantity = 0, description,
    status = 'Available', visibility = 'Visible',
    ingredients, tags,
  } = req.body;

  try {
    const [dup] = await pool.query('SELECT product_id FROM products WHERE sku = ?', [sku]);
    if (dup.length) return R.conflict(res, `SKU '${sku}' already exists.`);

    const [result] = await pool.query(
      `INSERT INTO products
         (category_id, product_name, sku, cost_price, selling_price, stock_quantity,
          description, status, visibility, ingredients, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, product_name, sku, cost_price, selling_price, stock_quantity,
       description || null, status, visibility, ingredients || null, tags || null]
    );
    const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ?', [result.insertId]);
    return R.created(res, rows[0]);
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function update(req, res) {
  const {
    category_id, product_name, sku, cost_price, selling_price,
    description, visibility, ingredients, tags,
  } = req.body;

  const fields = [];
  const params = [];

  if (category_id   !== undefined) { fields.push('category_id = ?');   params.push(category_id); }
  if (product_name  !== undefined) { fields.push('product_name = ?');  params.push(product_name); }
  if (sku           !== undefined) { fields.push('sku = ?');           params.push(sku); }
  if (cost_price    !== undefined) { fields.push('cost_price = ?');    params.push(cost_price); }
  if (selling_price !== undefined) { fields.push('selling_price = ?'); params.push(selling_price); }
  if (description   !== undefined) { fields.push('description = ?');   params.push(description); }
  if (visibility    !== undefined) { fields.push('visibility = ?');    params.push(visibility); }
  if (ingredients   !== undefined) { fields.push('ingredients = ?');   params.push(ingredients); }
  if (tags          !== undefined) { fields.push('tags = ?');          params.push(tags); }

  if (!fields.length) return R.badRequest(res, 'No fields to update.');
  params.push(req.params.id);

  try {
    const [result] = await pool.query(
      `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE product_id = ?`,
      params
    );
    if (!result.affectedRows) return R.notFound(res, 'Product not found.');
    const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Product updated.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function updateStatus(req, res) {
  const VALID = ['Available', 'Out of Stock', 'Discontinued'];
  const { status } = req.body;
  if (!VALID.includes(status)) return R.badRequest(res, `Status must be one of: ${VALID.join(', ')}`);

  try {
    const [result] = await pool.query(
      'UPDATE products SET status = ?, updated_at = NOW() WHERE product_id = ?',
      [status, req.params.id]
    );
    if (!result.affectedRows) return R.notFound(res, 'Product not found.');
    return R.ok(res, { status }, 'Status updated.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

async function remove(req, res) {
  try {
    // Soft delete: mark Discontinued + Hidden
    const [result] = await pool.query(
      "UPDATE products SET status = 'Discontinued', visibility = 'Hidden', updated_at = NOW() WHERE product_id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) return R.notFound(res, 'Product not found.');
    return R.ok(res, null, 'Product discontinued.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

module.exports = { list, getOne, create, update, updateStatus, remove };