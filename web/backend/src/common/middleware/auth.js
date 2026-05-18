// src/common/middleware/auth.js
// ============================================================
//  JWT authentication + Role-Based Access Control (RBAC)
//  Roles: admin | manager | sales | warehouse | finance
// ============================================================
const jwt = require('jsonwebtoken');
const { secret } = require('../../config/jwt');

/**
 * authenticate — verifies Bearer token, attaches user to req.user
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;   // { user_id, email, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/**
 * authorize(...roles) — middleware factory for role checking
 * Usage: router.get('/path', authenticate, authorize('admin','manager'), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}.`,
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };