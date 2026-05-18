// src/config/jwt.js
require('dotenv').config();

module.exports = {
  secret:         process.env.JWT_SECRET          || 'change_me',
  expiresIn:      process.env.JWT_EXPIRES_IN      || '8h',
  refreshSecret:  process.env.JWT_REFRESH_SECRET  || 'change_me_refresh',
  refreshExpires: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};