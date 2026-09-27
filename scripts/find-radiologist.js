// scripts/find-radiologist.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/prisma-client');

(async () => {
  try {
    const radiologists = await prisma.staff.findMany({
      where: { role: 'Radiologist' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        tenantId: true,
        isActive: true,
      },
    });

    console.log('\nRadiologists in the database:');
    console.log('─'.repeat(70));
    if (radiologists.length === 0) {
      console.log('  (none found)');
    } else {
      radiologists.forEach((r) => {
        console.log(`  ${r.firstName} ${r.lastName}`);
        console.log(`    id:       ${r.id}`);
        console.log(`    email:    ${r.email}`);
        console.log(`    tenantId: ${r.tenantId}`);
        console.log(`    active:   ${r.isActive}`);
        console.log('');
      });
    }
    console.log('─'.repeat(70));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();