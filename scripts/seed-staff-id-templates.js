// scripts/seed-staff-id-templates.js
//
// For every hospital that doesn't have a StaffIdTemplate yet,
// create one with sensible defaults derived from usernamePrefix.
// Idempotent — safe to re-run.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/prisma-client');

(async () => {
  console.log('🔧 Seeding StaffIdTemplate for existing hospitals...\n');

  const hospitals = await prisma.hospital.findMany({
    include: { StaffIdTemplate: true },
  });

  let created = 0;
  let skipped = 0;

  for (const h of hospitals) {
    if (h.StaffIdTemplate) {
      skipped++;
      console.log(`  ⏭️  ${h.name} — already has template`);
      continue;
    }

    const prefix = (h.usernamePrefix || h.code || h.slug || 'HOSP')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    try {
      await prisma.staffIdTemplate.create({
        data: {
          tenantId: h.id,
          displayFormat: `${prefix}/{DEPT}/{SEQ}`,
          loginKeyFormat: '{SEQ}',
          sequencePadding: 4,
          sequenceStrategy: 'RANDOM',
          departments: [],
          exampleId: null,
        },
      });
      created++;
      console.log(`  ✅ ${h.name} → template "${prefix}/{DEPT}/{SEQ}"`);
    } catch (err) {
      console.error(`  ❌ ${h.name} — ${err.message}`);
    }
  }

  console.log(`\n🎉 Done: ${created} created, ${skipped} skipped.`);
})().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});