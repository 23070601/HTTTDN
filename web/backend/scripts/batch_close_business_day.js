// scripts/batch_close_business_day.js
// ============================================================
//  FIX 5: In-store batch finalization job
//  Marks all in_store orders as Delivered once payment is confirmed
//  Should be called nightly via cron job
// ============================================================
require('dotenv').config();
const { pool } = require('../src/config/db');

async function closeBusinessDay() {
  const conn = await pool.getConnection();
  try {
    console.log('\n🔄  Starting in-store batch finalization...\n');

    await conn.beginTransaction();

    // FIX 5: Batch finalization for in_store channel only
    const [result] = await conn.query(`
      UPDATE orders
      SET delivery_status = 'Delivered', updated_at = NOW()
      WHERE sales_channel = 'in_store'
        AND payment_status = 'Paid'
        AND delivery_status NOT IN ('Delivered', 'Cancelled')
    `);

    const closedCount = result.affectedRows;

    if (closedCount > 0) {
      // Log batch finalization event
      await conn.query(
        `INSERT INTO audit_logs (action, module, risk_level, details)
         VALUES (?, 'Orders', 'Normal', ?)`,
        [
          `In-store batch finalization completed: ${closedCount} orders`,
          JSON.stringify({ batch_count: closedCount, batch_type: 'in_store_eod' })
        ]
      );
    }

    await conn.commit();
    console.log(`✅  Finalized ${closedCount} in-store orders\n`);
    return { success: true, closedCount };
  } catch (err) {
    await conn.rollback();
    console.error('\n❌  Batch finalization failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    conn.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  closeBusinessDay().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { closeBusinessDay };
