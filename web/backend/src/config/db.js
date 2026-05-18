// src/config/db.js
// ============================================================
//  MySQL connection pool — uses mysql2/promise for async/await
// ============================================================
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'CocoonSMS',
  waitForConnections: true,
  connectionLimit:    parseInt(process.env.DB_POOL_MAX || '10'),
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+07:00',  // Vietnam time
});

/**
 * Test the connection on startup.
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected — database:', conn.config.database);
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };