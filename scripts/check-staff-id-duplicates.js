// scripts/check-staff-id-duplicates.js
//
// Checks whether the compound unique constraint
// @@unique([tenantId, employeeIdKey, employeeIdYear])
// will succeed. Prints any duplicate groups.
//
// Safe to run anytime — read-only query.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/prisma-client');

(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        "tenantId",
        "employeeIdKey",
        "employeeIdYear",
        COUNT(*)::int AS cnt
      FROM "Staff"
      GROUP BY "tenantId", "employeeIdKey", "employeeIdYear"
      HAVING COUNT(*) > 1
    `);

    if (rows.length === 0) {
      console.log('✅ NO DUPLICATES — constraint will succeed');
      console.log('   Safe to answer "y" to the db push warning.');
    } else {
      console.log(`⚠️  Found ${rows.length} duplicate group(s):`);
      console.table(rows);
      console.log('\nResolve these before adding the constraint.');
    }
  } catch (err) {
    console.error('❌ Query failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();