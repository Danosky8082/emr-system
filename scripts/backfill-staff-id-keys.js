// scripts/backfill-staff-id-keys.js
//
// For every staff row where employeeIdKey is NULL:
//   1. Try extracting trailing digits from employeeId
//   2. If that key collides with an existing one, generate a random 4-digit number
//   3. Repeat up to 20 times for uniqueness
//   4. If 4-digit space is exhausted, expand to 5 digits
//
// Safe to re-run — only touches rows where employeeIdKey is NULL.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/prisma-client');

async function findFreeKey(tenantId, year) {
  // Try 20 times with a 4-digit number
  for (let attempt = 0; attempt < 20; attempt++) {
    const n = Math.floor(1000 + Math.random() * 9000); // 1000-9999
    const key = String(n);
    const existing = await prisma.staff.findFirst({
      where: { tenantId, employeeIdKey: key, employeeIdYear: year },
      select: { id: true },
    });
    if (!existing) return key;
  }

  // Fallback: 5-digit
  for (let attempt = 0; attempt < 20; attempt++) {
    const n = Math.floor(10000 + Math.random() * 90000); // 10000-99999
    const key = String(n);
    const existing = await prisma.staff.findFirst({
      where: { tenantId, employeeIdKey: key, employeeIdYear: year },
      select: { id: true },
    });
    if (!existing) return key;
  }

  throw new Error('Could not find a free key after 40 attempts');
}

(async () => {
  console.log('🔧 Backfilling employeeIdKey for existing staff...\n');

  const staff = await prisma.staff.findMany({
    where: { employeeIdKey: null },
    select: {
      id: true,
      employeeId: true,
      tenantId: true,
      createdAt: true,
      firstName: true,
      lastName: true,
    },
  });

  console.log(`Found ${staff.length} staff without employeeIdKey\n`);

  let sequential = 0;
  let randomized = 0;
  let failed = 0;

  for (const s of staff) {
    const match = String(s.employeeId || '').match(/(\d+)\s*$/);
    const year = new Date(s.createdAt).getFullYear();

    let key = null;
    let mode = 'random';

    // First try: extract trailing digits, IF they're unique
    if (match) {
      const candidateKey = match[1];
      const collision = await prisma.staff.findFirst({
        where: {
          tenantId: s.tenantId,
          employeeIdKey: candidateKey,
          employeeIdYear: year,
        },
        select: { id: true },
      });
      if (!collision) {
        key = candidateKey;
        mode = 'sequential';
      }
    }

    // Fallback: generate random
    if (!key) {
      try {
        key = await findFreeKey(s.tenantId, year);
      } catch (err) {
        failed++;
        console.log(`  ❌ ${s.employeeId} (${s.firstName} ${s.lastName}) — ${err.message}`);
        continue;
      }
    }

    try {
      await prisma.staff.update({
        where: { id: s.id },
        data: { employeeIdKey: key, employeeIdYear: year },
      });
      if (mode === 'sequential') {
        sequential++;
        console.log(`  ✅ ${s.employeeId} → key=${key}, year=${year}`);
      } else {
        randomized++;
        console.log(`  🎲 ${s.employeeId} → key=${key} (random), year=${year}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ❌ ${s.employeeId} — ${err.message}`);
    }
  }

  console.log(
    `\n🎉 Done: ${sequential} sequential, ${randomized} randomized, ${failed} failed.`
  );
})().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});