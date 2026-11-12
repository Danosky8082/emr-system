
// scripts/migrate-legacy-staff-ids.js
//
// One-off migration: rewrite employee IDs for staff whose IDs still use
// the OLD format (e.g. "ADMIN001", "fgc", "stmarys001") so they match
// the hospital's StaffIdTemplate (e.g. "CARETECH/ADMIN/001").
//
// - employeeIdKey (short number) is PRESERVED — it already exists on
//   every row and is already unique per tenant
// - employeeIdYear is PRESERVED — already 2026
// - username is PRESERVED (caretech-admin etc. still work as login)
// - Only employeeId is rewritten, using the template display format
//
// Safe to re-run — skips rows whose employeeId already contains "/"
// (the tell for "this row is already in the new format").
//
// Usage:
//   node scripts/migrate-legacy-staff-ids.js --dry-run
//   node scripts/migrate-legacy-staff-ids.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/prisma-client');

const DRY_RUN = process.argv.includes('--dry-run');

const ROLE_DEPT_CODES = {
  Admin: 'ADMIN', ITAdmin: 'IT', ITSupport: 'IT',
  Doctor: 'MED', Nurse: 'NURS',
  Obstetrician: 'OBG', Midwife: 'MID',
  Radiologist: 'RAD', Dentist: 'DENT', Optometrist: 'OPTO',
  Ophthalmologist: 'OPHT', Paediatrician: 'PAED',
  Surgeon: 'SURG', Psychiatrist: 'PSY', Dermatologist: 'DERM',
  Cardiologist: 'CARD', Neurologist: 'NEUR', Orthopedic: 'ORTH',
  ENT: 'ENT', Urologist: 'UROL', Anaesthesiologist: 'ANAES',
  Pathologist: 'PATH', Pharmacist: 'PHARM',
  LabTechnician: 'LAB', LabScientist: 'LAB',
  Accountant: 'ACC', BillingOfficer: 'BILL',
  Records: 'REC', Receptionist: 'RECEP', HR: 'HR',
};

function cleanDeptCode(str) {
  return String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function pickDeptCode(staff, roleDeptCodes) {
  if (staff.department?.name) {
    const fromDept = cleanDeptCode(staff.department.name);
    if (fromDept) return fromDept;
  }
  if (roleDeptCodes[staff.role]) return roleDeptCodes[staff.role];
  return 'GEN';
}

async function buildDisplayId(tenantId, deptCode, shortNumber, year) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: tenantId },
    select: { usernamePrefix: true, code: true },
  });
  const template = await prisma.staffIdTemplate.findUnique({ where: { tenantId } });

  const prefix = (hospital?.usernamePrefix || hospital?.code || 'HOSP')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');

  const format = template?.displayFormat || '{PREFIX}/{DEPT}/{SEQ}';
  return format
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{DEPT\}/g, deptCode)
    .replace(/\{YEAR\}/g, String(year))
    .replace(/\{SEQ\}/g, shortNumber);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  LEGACY STAFF ID MIGRATION  ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const year = new Date().getFullYear();

  const staff = await prisma.staff.findMany({
    where: { NOT: { employeeId: { contains: '/' } } },
    select: {
      id: true,
      employeeId: true,
      employeeIdKey: true,
      employeeIdYear: true,
      tenantId: true,
      role: true,
      firstName: true,
      lastName: true,
      username: true,
      department: { select: { name: true } },
      Hospital: { select: { name: true, slug: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { employeeId: 'asc' }],
  });

  if (staff.length === 0) {
    console.log('▸ No legacy-format staff found — nothing to migrate.');
    console.log('');
    await prisma.$disconnect();
    return;
  }

  console.log(`▸ Found ${staff.length} legacy-format staff to migrate`);
  console.log('');

  const plan = [];
  let skippedNoKey = 0;

  for (const s of staff) {
    // If a row somehow has no employeeIdKey, skip it — this migration
    // preserves keys, doesn't generate new ones. (Would need a different
    // script to backfill keys; but per inspection output, all rows have one.)
    if (!s.employeeIdKey) {
      skippedNoKey++;
      continue;
    }

    const deptCode = pickDeptCode(s, ROLE_DEPT_CODES);
    const newEmployeeId = await buildDisplayId(
      s.tenantId,
      deptCode,
      s.employeeIdKey,
      s.employeeIdYear || year
    );

    plan.push({ staff: s, deptCode, newEmployeeId });
  }

  console.log('▸ Migration plan:');
  console.log('');
  console.log(
    '  ' +
      'Hospital'.padEnd(30) +
      'Current ID'.padEnd(18) +
      'New ID'.padEnd(28) +
      'Key'.padEnd(8) +
      'Username (kept)'
  );
  console.log('  ' + '─'.repeat(120));
  for (const item of plan) {
    console.log(
      '  ' +
        String(item.staff.Hospital?.name || '(unknown)').padEnd(30) +
        String(item.staff.employeeId).padEnd(18) +
        item.newEmployeeId.padEnd(28) +
        String(item.staff.employeeIdKey).padEnd(8) +
        item.staff.username
    );
  }
  console.log('');

  if (skippedNoKey > 0) {
    console.log(`⚠️  ${skippedNoKey} staff skipped — no employeeIdKey set`);
    console.log('');
  }

  if (DRY_RUN) {
    console.log('▸ DRY RUN — no changes applied.');
    console.log('  Run without --dry-run to apply.');
    console.log('');
    await prisma.$disconnect();
    return;
  }

  console.log('▸ Applying changes...');
  let updated = 0;
  for (const item of plan) {
    try {
      await prisma.staff.update({
        where: { id: item.staff.id },
        data: { employeeId: item.newEmployeeId },
      });
      console.log(`  OK  ${item.staff.employeeId} -> ${item.newEmployeeId}`);
      updated++;
    } catch (err) {
      console.log(`  FAIL ${item.staff.employeeId}: ${err.message}`);
    }
  }

  console.log('');
  console.log(`▸ Done. ${updated} of ${plan.length} staff migrated.`);
  console.log('');
  console.log('  Login methods after migration:');
  console.log('    ✅ short number (e.g. 4821 + password)   — unchanged');
  console.log('    ✅ old username (caretech-admin, ...)     — unchanged');
  console.log('    ❌ old employee ID (ADMIN001, DOC001, …)  — no longer works');
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});