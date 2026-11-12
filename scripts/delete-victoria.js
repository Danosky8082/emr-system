// scripts/delete-victoria.js
//
// One-off: remove the staff record created before Message 2 was deployed.
// Victoria's employeeId is "001" which collides with the short-number
// scheme that ADMIN001/HR001/etc use after backfill.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/prisma-client');

(async () => {
  try {
    const staff = await prisma.staff.findFirst({
      where: { username: 'caretech-8814' },
      select: { id: true, employeeId: true, firstName: true, lastName: true },
    });

    if (!staff) {
      console.log('⚠️  Not found — already deleted?');
      return;
    }

    console.log(`Found: ${staff.firstName} ${staff.lastName} (${staff.employeeId})`);

    await prisma.staff.delete({ where: { id: staff.id } });
    console.log(`✅ Deleted: ${staff.employeeId}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();