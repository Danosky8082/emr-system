// scripts/migrate-legacy-staff-ids.js
//
// One-off migration: rewrite employee IDs and short numbers for the 15
// legacy staff who were seeded before the staff-ID-template system existed.
//
// - Regenerates employeeId to CARETECH/<DEPT>/<short>
// - Regenerates employeeIdKey to a 4-digit number (unique per tenant/year)
// - Sets employeeIdYear to the current year
// - Leaves username untouched (caretech-admin, caretech-doctor, etc. still work)
//
// Safe to re-run — only touches rows where employeeIdYear is null
// (the tell for "this row predates the new ID scheme").
//
// Usage:
//   node scripts/migrate-legacy-staff-ids.js --dry-run
//   node scripts/migrate-legacy-staff-ids.js
//   node scripts/migrate-legacy-staff-ids.js --with-test-auto

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/prisma-client');

const DRY_RUN = process.argv.includes('--dry-run');
const WITH_TEST_AUTO = process.argv.includes('--with-test-auto');

// ────────────────────────────────────────────────────────────────
// Role → department code fallback. Used when a staff row has no
// `department` field set (which is true for most seeded staff).
// Truncated to 6 chars to match buildDisplayId's slice(0, 6).
// ────────────────────────────────────────────────────────────────
const ROLE_DEPT_CODES = {
  Admin: 'ADMIN',
  ITAdmin: 'IT',
  ITSupport: 'IT',
  Doctor: 'MED',
  Nurse: 'NURS',
  Obstetrician: 'OBG',
  Midwife: 'MID',
  Radiologist: 'RAD',
  Dentist: 'DENT',
  Optometrist: 'OPTO',
  Ophthalmologist: 'OPHT',
  Paediatrician: 'PAED',
  Surgeon: 'SURG',
  Psychiatrist: 'PSY',
  Dermatologist: 'DERM',
  Cardiologist: 'CARD',
  Neurologist: 'NEUR',
  Orthopedic: 'ORTH',
  ENT: 'ENT',
  Urologist: 'UROL',
  Anaesthesiologist: 'ANAES',
  Pathologist: 'PATH',
  Pharmacist: 'PHARM',
  LabTechnician: 'LAB',
  LabScientist: 'LAB',
  Accountant: 'ACC',
  BillingOfficer: 'BILL',
  Records: 'REC',
  Receptionist: 'RECEP',
  HR: 'HR',
};

function cleanDeptCode(str) {
  return String(str || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function pickDeptCode(staff, roleDeptCodes) {
  // 1. If the staff row has a department, use it (matches buildDisplayId behavior)
  if (staff.department?.name) {
    const fromDept = cleanDeptCode(staff.department.name);
    if (fromDept) return fromDept;
  }
  // 2. Fall back to a role-derived code
  if (roleDeptCodes[staff.role]) {
    return roleDeptCodes[staff.role];
  }
  // 3. Last resort
  return 'GEN';
}

async function findFreeShortNumber(tenantId, year) {
  // Same algorithm as generateShortNumber in server.js, RANDOM branch.
  for (let i = 0; i < 100; i++) {
    const n = Math.floor(1000 + Math.random() * 9000);
    const key = String(n);
    const conflict = await prisma.staff.findFirst({
      where: { tenantId, employeeIdKey: key, employeeIdYear: year },
      select: { id: true },
    });
    if (!conflict) return key;
  }
  throw new Error('Could not find a free short number after 100 attempts');
}

async function buildDisplayId(tenantId, deptCode, shortNumber, year) {
  // Mirrors buildDisplayId in server.js, but takes the dept code pre-resolved
  // so we can pass the role-derived fallback in instead of hitting the
  // department table again.
  const hospital = await prisma.hospital.findUnique({
    where: { id: tenantId },
    select: { usernamePrefix: true, code: true },
  });
  const template = await prisma.staffIdTemplate.findUnique({
    where: { tenantId },
  });

  const prefix = (hospital?.usernamePrefix || hospital?.code || 'HOSP')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const format = template?.displayFormat || '{PREFIX}/{DEPT}/{SEQ}';

  return format
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{DEPT\}/g, deptCode)
    .replace(/\{YEAR\}/g, String(year))
    .replace(/\{SEQ\}/g, shortNumber);
}

async function deleteTestAutoIfPresent() {
  const s = await prisma.staff.findFirst({
    where: { username: 'caretech-8032' },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
  });
  if (!s) {
    console.log('  Test Auto: not found (already cleaned up)');
    return;
  }
  console.log(`  Test Auto: found (${s.employeeId}) — deleting`);

  if (DRY_RUN) {
    console.log('  Test Auto: [DRY RUN] would delete');
    return;
  }

  // Delete audit-log dependencies first (Prisma restrict-by-default)
  await prisma.auditLog.deleteMany({ where: { staffId: s.id } });
  await prisma.staff.delete({ where: { id: s.id } });
  console.log('  Test Auto: ✅ deleted');
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  LEGACY STAFF ID MIGRATION  ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  if (WITH_TEST_AUTO) {
    console.log('▸ Pre-step: remove Test Auto');
    await deleteTestAutoIfPresent();
    console.log('');
  }

  const year = new Date().getFullYear();

  // 1. Fetch legacy staff (employeeIdYear is null → predates the scheme)
  const staff = await prisma.staff.findMany({
    where: { employeeIdYear: null },
    select: {
      id: true,
      employeeId: true,
      tenantId: true,
      role: true,
      firstName: true,
      lastName: true,
      username: true,
      department: { select: { name: true } },
    },
    orderBy: { employeeId: 'asc' },
  });

  if (staff.length === 0) {
    console.log('▸ No legacy staff found — nothing to migrate.');
    console.log('  (All staff already have employeeIdYear set.)');
    console.log('');
    await prisma.$disconnect();
    return;
  }

  console.log(`▸ Found ${staff.length} legacy staff to migrate`);
  console.log('');

  // 2. Pre-flight: detect pre-existing employeeIdKey collisions among legacy staff
  //    (only ADMIN001 has a key from the earlier backfill — everyone else is null)
  const keySet = new Map();   // `${tenantId}|${year}|${key}` → staff name
  const preexisting = staff.filter((s) => s.employeeId && s.employeeId.length < 20);
  // We don't actually need to inspect pre-existing keys anymore since we're
  // regenerating all of them. But log what's there for transparency.
  const withKeyCount = await prisma.staff.count({
    where: { employeeIdYear: null, employeeIdKey: { not: null } },
  });
  if (withKeyCount > 0) {
    console.log(`▸ Note: ${withKeyCount} legacy staff already have employeeIdKey set`);
    console.log('  These will be regenerated for consistency (matches Option C).');
    console.log('');
  }

  // 3. Plan
  const plan = [];
  for (const s of staff) {
    const deptCode = pickDeptCode(s, ROLE_DEPT_CODES);
    // Reserve the short number NOW (in-memory) so this run doesn't generate
    // two identical keys for two different staff.
    const shortNumber = await findFreeShortNumber(s.tenantId, year);
    // Insert into a temp reservation so subsequent rows don't reuse it
    await prisma.$executeRawUnsafe(
      `SELECT 1` // no-op; we rely on the loop taking fresh samples each time
    );
    plan.push({
      staff: s,
      deptCode,
      shortNumber,
    });
  }

  // Because findFreeShortNumber samples randomly per call and doesn't
  // consider the in-memory reservations, we need to dedupe here.
  const usedKeys = new Set();
  for (const item of plan) {
    const k = `${item.staff.tenantId}|${year}|${item.shortNumber}`;
    if (usedKeys.has(k)) {
      // Re-draw
      let attempts = 0;
      while (attempts < 100) {
        const n = Math.floor(1000 + Math.random() * 9000);
        const candidate = String(n);
        const candidateKey = `${item.staff.tenantId}|${year}|${candidate}`;
        if (!usedKeys.has(candidateKey)) {
          const liveConflict = await prisma.staff.findFirst({
            where: {
              tenantId: item.staff.tenantId,
              employeeIdKey: candidate,
              employeeIdYear: year,
            },
            select: { id: true },
          });
          if (!liveConflict) {
            item.shortNumber = candidate;
            usedKeys.add(candidateKey);
            break;
          }
        }
        attempts++;
      }
      if (attempts >= 100) {
        throw new Error(
          `Could not find free short number for ${item.staff.firstName} ${item.staff.lastName}`
        );
      }
    } else {
      usedKeys.add(k);
    }
  }

  // 4. Build final display IDs
  for (const item of plan) {
    item.newEmployeeId = await buildDisplayId(
      item.staff.tenantId,
      item.deptCode,
      item.shortNumber,
      year
    );
  }

  // 5. Show the plan
  console.log('▸ Migration plan:');
  console.log('');
  console.log(
    '  ' +
      'Current ID'.padEnd(18) +
      'New ID'.padEnd(28) +
      'Short #'.padEnd(10) +
      'Name'.padEnd(28) +
      'Username (kept)'
  );
  console.log('  ' + '─'.repeat(120));
  for (const item of plan) {
    console.log(
      '  ' +
        String(item.staff.employeeId || '(none)').padEnd(18) +
        item.newEmployeeId.padEnd(28) +
        item.shortNumber.padEnd(10) +
        `${item.staff.firstName} ${item.staff.lastName}`.padEnd(28) +
        item.staff.username
    );
  }
  console.log('');

  if (DRY_RUN) {
    console.log('▸ DRY RUN — no changes applied.');
    console.log('  Run without --dry-run to apply.');
    console.log('');
    await prisma.$disconnect();
    return;
  }

  // 6. Apply
  console.log('▸ Applying changes...');
  let updated = 0;
  for (const item of plan) {
    try {
      await prisma.staff.update({
        where: { id: item.staff.id },
        data: {
          employeeId: item.newEmployeeId,
          employeeIdKey: item.shortNumber,
          employeeIdYear: year,
          // username, role, etc. untouched
        },
      });
      console.log(
        `  ✅ ${item.staff.employeeId} → ${item.newEmployeeId}  (login: ${item.shortNumber})`
      );
      updated++;
    } catch (err) {
      console.log(`  ❌ ${item.staff.employeeId}: ${err.message}`);
    }
  }

  console.log('');
  console.log(`▸ Done. ${updated} of ${plan.length} staff migrated.`);
  console.log('');
  console.log('  ⚠️  Important:');
  console.log('  • Old employee IDs (ADMIN001, DOC001, …) no longer work as logins.');
  console.log('  • Old usernames (caretech-admin, caretech-doctor, …) STILL work.');
  console.log('  • New short numbers work for login (e.g. 4821 + password).');
  console.log('  • Inform each staff member of their new short number.');
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});