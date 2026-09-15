// fix-soft-delete-groupby.js
// 1. Excludes groupBy from the auto-filter in src/prisma-client.js
// 2. Adds deletedAt: null to Patient groupBy calls in server.js

const fs = require('fs');
const path = require('path');

// ============================================================
// Fix 1 — Update src/prisma-client.js
// ============================================================
const CLIENT_FILE = path.join(__dirname, 'src', 'prisma-client.js');
const CLIENT_BACKUP = CLIENT_FILE + '.before-groupby-fix';

if (!fs.existsSync(CLIENT_BACKUP)) {
  fs.copyFileSync(CLIENT_FILE, CLIENT_BACKUP);
  console.log(`📦 Backup: ${path.basename(CLIENT_BACKUP)}`);
}

let clientContent = fs.readFileSync(CLIENT_FILE, 'utf8');

// Match the auto-filter block (regardless of whitespace)
const oldBlockRegex = /if \(model === 'Patient'\) \{[\s\S]*?if \(!alreadyFilters\) \{[\s\S]*?args\.where = \{ \.\.\.args\.where, deletedAt: null \};[\s\S]*?\}[\s\S]*?\}/;

const newBlock = `if (model === 'Patient') {
    // ⚠️ groupBy is EXCLUDED — Prisma rejects auto-injected fields for groupBy
    const isReadOp = [
      'findFirst', 'findMany', 'findUnique', 'count',
      'aggregate', 'findFirstOrThrow', 'findUniqueOrThrow'
    ].includes(operation);

    if (isReadOp) {
      const alreadyFilters = args.where && 'deletedAt' in args.where;
      if (!alreadyFilters) {
        args.where = { ...args.where, deletedAt: null };
      }
    }
  }`;

const match = clientContent.match(oldBlockRegex);
if (match) {
  clientContent = clientContent.replace(oldBlockRegex, newBlock);
  fs.writeFileSync(CLIENT_FILE, clientContent, 'utf8');
  console.log(`✅ Fix 1: groupBy excluded from auto-filter in src/prisma-client.js`);
} else {
  console.log(`⚠️  Fix 1: auto-filter block not found. Here's the current block:`);
  const idx = clientContent.indexOf("model === 'Patient'");
  if (idx !== -1) {
    console.log(clientContent.substring(idx, idx + 500));
  } else {
    console.log('   No "model === \'Patient\'" found');
  }
}

// ============================================================
// Fix 2 — Add deletedAt: null to Patient groupBy calls in server.js
// ============================================================
const SERVER_FILE = path.join(__dirname, 'server.js');
const SERVER_BACKUP = SERVER_FILE + '.before-groupby-fix';

if (!fs.existsSync(SERVER_BACKUP)) {
  fs.copyFileSync(SERVER_FILE, SERVER_BACKUP);
  console.log(`📦 Backup: ${path.basename(SERVER_BACKUP)}`);
}

let serverContent = fs.readFileSync(SERVER_FILE, 'utf8');

// Find all `req.db.patient.groupBy({...})` calls that DON'T have `where:`
// Use a scanner approach: find each occurrence, check for a `where` before the closing `}`
const calls = [];
let idx = 0;
while ((idx = serverContent.indexOf('req.db.patient.groupBy(', idx)) !== -1) {
  // Find matching closing paren by counting braces from idx
  let depth = 0;
  let start = idx + 'req.db.patient.groupBy('.length - 1; // position of the '('
  let pos = start;
  let end = -1;
  for (; pos < serverContent.length; pos++) {
    const ch = serverContent[pos];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) { end = pos; break; }
    }
  }
  if (end === -1) break;
  const block = serverContent.substring(start, end + 1);
  calls.push({ start, end, block });
  idx = end + 1;
}

console.log(`\n📍 Found ${calls.length} groupBy call(s) on Patient:`);

let fixCount = 0;
// Process in reverse to preserve indices
for (let i = calls.length - 1; i >= 0; i--) {
  const { start, end, block } = calls[i];
  const lineNum = serverContent.substring(0, start).split('\n').length;

  if (block.includes('where:')) {
    console.log(`   Line ${lineNum}: already has where — skipping`);
    continue;
  }

  // Insert `where: { deletedAt: null }` before the closing `}`
  // The block ends with `})` — we insert before the closing `}`
  const inner = block.slice(1, -1); // strip outer ( )
  const trimmed = inner.trimEnd();
  const newInner = trimmed.endsWith(',')
    ? `${trimmed} where: { deletedAt: null } `
    : `${trimmed}, where: { deletedAt: null } `;

  const newBlock = `(${newInner})`;
  serverContent = serverContent.substring(0, start) + newBlock + serverContent.substring(end + 1);
  fixCount++;
  console.log(`   Line ${lineNum}: added 'where: { deletedAt: null }'`);
}

if (fixCount > 0) {
  fs.writeFileSync(SERVER_FILE, serverContent, 'utf8');
  console.log(`\n✅ Fix 2: Updated ${fixCount} groupBy call(s)`);
} else {
  console.log(`\n⚠️  Fix 2: no unfiltered groupBy calls to fix`);
}

// ============================================================
// Verify
// ============================================================
console.log('\n=== VERIFICATION ===');
const { execSync } = require('child_process');
try {
  execSync('node -c server.js', { stdio: 'inherit' });
  console.log('✅ server.js syntax OK');
} catch (e) {
  console.error('❌ server.js syntax error — restoring');
  fs.copyFileSync(SERVER_BACKUP, SERVER_FILE);
  process.exit(1);
}