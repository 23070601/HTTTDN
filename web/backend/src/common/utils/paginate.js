// src/common/utils/paginate.js
// ============================================================
//  Build LIMIT / OFFSET from req.query + return pagination meta
// ============================================================

function getPagination(query) {
  const page  = Math.max(1, parseInt(query.page  || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { getPagination };