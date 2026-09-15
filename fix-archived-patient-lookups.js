// fix-archived-patient-lookups.js
// Fixes only the endpoints that MUST find archived/soft-deleted patients.
// Adds a helper and replaces findUnique with the helper in 5 specific locations.

const fs = require('fs');
const BACKUP = 'server.js.before-archived-fix';

if (!fs.existsSync(BACKUP)) {
  fs.copyFileSync('server.js', BACKUP);
  console.log(`📦 Backup: ${BACKUP}`);
}

let content = fs.readFileSync('server.js', 'utf8');
const original = content;

// ============================================================
// STEP 1: Add the helper after the imports
// ============================================================
const importMarker = `const { prisma, getTenantPrisma } = require('./src/prisma-client');`;
const helperCode = `${importMarker}

// ============================================================
// Helper: Find a patient by ID, INCLUDING soft-deleted patients.
// Use in endpoints that operate on ARCHIVED or SOFT-DELETED patients.
// Auto-filter normally hides them; this bypasses it explicitly.
// ============================================================
async function findPatientIncludingDeleted(db, id) {
  return db.patient.findFirst({
    where: {
      id,
      OR: [
        { deletedAt: null },
        { deletedAt: { not: null } }
      ]
    }
  });
}`;

if (!content.includes('async function findPatientIncludingDeleted')) {
  if (content.includes(importMarker)) {
    content = content.replace(importMarker, helperCode);
    console.log('✅ Added findPatientIncludingDeleted helper');
  } else {
    console.log('⚠️  Could not find import marker. Adding helper at line 15.');
    const lines = content.split('\n');
    lines.splice(15, 0, helperCode.split('\n').slice(1).join('\n'));
    content = lines.join('\n');
  }
} else {
  console.log('✅ Helper already exists');
}

// ============================================================
// STEP 2: Fix the 4 archived-patient endpoints
// ============================================================

// --- Line 1987: POST /api/patients/:id/unarchive ---
content = content.replace(
  /app\.post\('\/api\/patients\/:id\/unarchive'[\s\S]{0,500}?const existingPatient = await req\.db\.patient\.findUnique\(\{ where: \{ id \} \}\);/,
  (match) => match.replace(
    'const existingPatient = await req.db.patient.findUnique({ where: { id } });',
    'const existingPatient = await findPatientIncludingDeleted(req.db, id);'
  )
);
console.log('✅ Fix 1: /api/patients/:id/unarchive');

// --- Line 2056: POST /api/patients/:id/activate ---
content = content.replace(
  /app\.post\('\/api\/patients\/:id\/activate'[\s\S]{0,500}?const patient = await req\.db\.patient\.findUnique\(\{ where: \{ id \} \}\);/,
  (match) => match.replace(
    'const patient = await req.db.patient.findUnique({ where: { id } });',
    'const patient = await findPatientIncludingDeleted(req.db, id);'
  )
);
console.log('✅ Fix 2: /api/patients/:id/activate');

// --- Line 2211: POST /api/patients/:id/request-reactivation ---
content = content.replace(
  /app\.post\('\/api\/patients\/:id\/request-reactivation'[\s\S]{0,500}?const patient = await req\.db\.patient\.findUnique\(\{ where: \{ id \} \}\);/,
  (match) => match.replace(
    'const patient = await req.db.patient.findUnique({ where: { id } });',
    'const patient = await findPatientIncludingDeleted(req.db, id);'
  )
);
console.log('✅ Fix 3: /api/patients/:id/request-reactivation');

// --- Line 1647: GET /api/patients/:id (profile) ---
// Special: needs to allow deleted patient for Records to view
content = content.replace(
  /app\.get\('\/api\/patients\/:id',[\s\S]{0,800}?const patient = await req\.db\.patient\.findUnique\(\{\s*where: \{ id: patientId \},/,
  (match) => match.replace(
    `const patient = await req.db.patient.findUnique({\n      where: { id: patientId },`,
    `const patient = await req.db.patient.findFirst({\n      where: {\n        id: patientId,\n        OR: [{ deletedAt: null }, { deletedAt: { not: null } }]\n      },`
  )
);
console.log('✅ Fix 4: /api/patients/:id (main profile)');

// ============================================================
// STEP 3: Verify and save
// ============================================================
if (content === original) {
  console.log('\n⚠️  No changes made.');
  process.exit(1);
}

fs.writeFileSync('server.js', content, 'utf8');
console.log('\n💾 server.js updated');

// Syntax check
const { execSync } = require('child_process');
console.log('\n=== VERIFICATION ===');
try {
  execSync('node -c server.js', { stdio: 'inherit' });
  console.log('✅ Syntax OK');
} catch (e) {
  console.error('❌ Syntax error — restoring backup');
  fs.copyFileSync(BACKUP, 'server.js');
  process.exit(1);
}

// Report remaining findUnique on patient by id
const remaining = (content.match(/req\.db\.patient\.findUnique\(\{\s*where:\s*\{\s*id/g) || []).length;
console.log(`\n📊 Remaining patient.findUnique({ where: { id } }): ${remaining}`);
console.log('   These are OK (portal-flow endpoints that should hide deleted patients)');