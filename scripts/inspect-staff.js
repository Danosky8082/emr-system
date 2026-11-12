// scripts/inspect-staff.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/prisma-client');

(async () => {
  const url = process.env.DATABASE_URL || '';
  const sanitized = url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  const host = sanitized.split('@')[1]?.split('/')[0] || '(unknown)';
  console.log('DATABASE_URL host:', host);

  const all = await prisma.staff.findMany({
    select: {
      employeeId: true,
      username: true,
      role: true,
      employeeIdKey: true,
      employeeIdYear: true,
      tenantId: true,
    },
    orderBy: { employeeId: 'asc' },
  });

  console.log(`\nTotal staff rows: ${all.length}\n`);
  console.log(
    'Employee ID'.padEnd(30) +
    'Username'.padEnd(24) +
    'Role'.padEnd(16) +
    'Key'.padEnd(8) +
    'Year'
  );
  console.log('-'.repeat(90));
  for (const s of all) {
    console.log(
      String(s.employeeId || '(none)').padEnd(30) +
      String(s.username || '(none)').padEnd(24) +
      String(s.role || '').padEnd(16) +
      String(s.employeeIdKey ?? 'NULL').padEnd(8) +
      String(s.employeeIdYear ?? 'NULL')
    );
  }
  await prisma.$disconnect();
})();