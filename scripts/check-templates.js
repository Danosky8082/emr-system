// scripts/check-templates.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/prisma-client');

(async () => {
  try {
    const templates = await prisma.staffIdTemplate.findMany({
      include: { Hospital: { select: { name: true, slug: true, usernamePrefix: true } } },
    });

    if (templates.length === 0) {
      console.log('❌ NO TEMPLATES FOUND');
      console.log('   Run: node scripts/seed-staff-id-templates.js');
      return;
    }

    console.log(`✅ ${templates.length} template(s) found:\n`);
    for (const t of templates) {
      console.log(`  Hospital:        ${t.Hospital?.name} (${t.Hospital?.slug})`);
      console.log(`  tenantId:        ${t.tenantId}`);
      console.log(`  displayFormat:   ${t.displayFormat}`);
      console.log(`  loginKeyFormat:  ${t.loginKeyFormat}`);
      console.log(`  sequencePadding: ${t.sequencePadding}`);
      console.log(`  strategy:        ${t.sequenceStrategy}`);
      console.log(`  prefix:          ${t.Hospital?.usernamePrefix}`);
      console.log('');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();