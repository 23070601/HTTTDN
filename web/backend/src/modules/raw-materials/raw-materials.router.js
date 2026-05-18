// src/modules/raw-materials/raw-materials.router.js
const express    = require('express');
const router     = express.Router();
const { body }   = require('express-validator');
const { pool }   = require('../../config/db');
const R = require('../../common/utils/response');
const { authenticate, authorize } = require('../../common/middleware/auth');
const { getPagination } = require('../../common/utils/paginate');

router.use(authenticate);

router.get('/', async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { status, search } = req.query;
  let where = 'WHERE 1=1'; const params = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (search) { where += ' AND (material_name LIKE ? OR supplier_name LIKE ? OR origin LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM raw_materials ${where}`, params);
    const [rows] = await pool.query(`SELECT * FROM raw_materials ${where} ORDER BY status, material_name LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) { return R.serverError(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM raw_materials WHERE material_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Material not found.');
    return R.ok(res, rows[0]);
  } catch (err) { return R.serverError(res, err); }
});

router.post(
  '/',
  authorize('warehouse', 'admin', 'manager'),
  [body('material_name').notEmpty(), body('origin').notEmpty(), body('supplier_name').notEmpty()],
  async (req, res) => {
    const { material_name, origin, supplier_name, quantity = 0, unit = 'kg', status = 'Stable', import_date, expiry_date } = req.body;
    try {
      const [result] = await pool.query(
        'INSERT INTO raw_materials (material_name, origin, supplier_name, quantity, unit, status, import_date, expiry_date) VALUES (?,?,?,?,?,?,?,?)',
        [material_name, origin, supplier_name, quantity, unit, status, import_date || null, expiry_date || null]
      );
      const [rows] = await pool.query('SELECT * FROM raw_materials WHERE material_id = ?', [result.insertId]);
      return R.created(res, rows[0]);
    } catch (err) { return R.serverError(res, err); }
  }
);

router.put('/:id', authorize('warehouse', 'admin', 'manager'), async (req, res) => {
  const { material_name, origin, supplier_name, quantity, unit, status, import_date, expiry_date } = req.body;
  const fields = []; const params = [];
  if (material_name !== undefined) { fields.push('material_name = ?'); params.push(material_name); }
  if (origin        !== undefined) { fields.push('origin = ?');        params.push(origin); }
  if (supplier_name !== undefined) { fields.push('supplier_name = ?'); params.push(supplier_name); }
  if (quantity      !== undefined) { fields.push('quantity = ?');      params.push(quantity); }
  if (unit          !== undefined) { fields.push('unit = ?');          params.push(unit); }
  if (status        !== undefined) { fields.push('status = ?');        params.push(status); }
  if (import_date   !== undefined) { fields.push('import_date = ?');   params.push(import_date); }
  if (expiry_date   !== undefined) { fields.push('expiry_date = ?');   params.push(expiry_date); }
  if (!fields.length) return R.badRequest(res, 'No fields to update.');
  params.push(req.params.id);
  try {
    const [result] = await pool.query(`UPDATE raw_materials SET ${fields.join(', ')}, updated_at = NOW() WHERE material_id = ?`, params);
    if (!result.affectedRows) return R.notFound(res, 'Material not found.');
    const [rows] = await pool.query('SELECT * FROM raw_materials WHERE material_id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Material updated.');
  } catch (err) { return R.serverError(res, err); }
});

module.exports = router;