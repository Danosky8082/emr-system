// scripts/verify-schema.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/prisma-client');

(async () => {
  const staffCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Staff'
      AND column_name IN ('employeeIdKey','employeeIdYear','mustChangePassword')
  `);
  console.log('Staff new columns:', staffCols);

  const hospitalCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Hospital'
      AND column_name IN ('deletedAt','deletedBy','deleteReason','patientIdPrefix')
  `);
  console.log('Hospital new columns:', hospitalCols);

  const templates = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS cnt FROM "StaffIdTemplate"
  `);
  console.log('StaffIdTemplate row count:', templates);

  await prisma.$disconnect();
})();