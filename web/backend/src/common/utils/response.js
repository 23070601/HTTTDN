// src/common/utils/response.js
// ============================================================
//  Standardised API response helpers
// ============================================================

function ok(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function created(res, data, message = 'Created successfully') {
  return ok(res, data, message, 201);
}

function paginated(res, { rows, total, page, limit }) {
  return res.status(200).json({
    success:     true,
    data:        rows,
    pagination:  { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
  });
}

function badRequest(res, message = 'Bad request', errors = null) {
  return res.status(400).json({ success: false, message, errors });
}

function unauthorized(res, message = 'Unauthorized') {
  return res.status(401).json({ success: false, message });
}

function forbidden(res, message = 'Forbidden') {
  return res.status(403).json({ success: false, message });
}

function notFound(res, message = 'Resource not found') {
  return res.status(404).json({ success: false, message });
}

function conflict(res, message = 'Conflict') {
  return res.status(409).json({ success: false, message });
}

function serverError(res, err) {
  console.error('[Server Error]', err);
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  return res.status(500).json({ success: false, message });
}

module.exports = { ok, created, paginated, badRequest, unauthorized, forbidden, notFound, conflict, serverError };