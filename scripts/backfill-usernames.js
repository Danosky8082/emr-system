const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  console.error('   Expected in:', path.join(__dirname, '..', '.env'));
  process.exit(1);
}

// Show which DB we're about to touch — without leaking the password
try {
  const u = new URL(process.env.DATABASE_URL);
  console.log(`✓ DATABASE_URL → ${u.host}${u.pathname}`);
} catch {
  console.log('✓ DATABASE_URL loaded (could not parse for display)');
}

const { prisma } = require('../src/prisma-client');

async function generateUsername(prefix, tenantId, tx = prisma) {
  const base = String(prefix)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!base) throw new Error('Invalid prefix');

  for (let i = 0; i < 50; i++) {
    const candidate = `${base}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const exists = await tx.staff.findFirst({
      where: { tenantId, username: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new Error('Could not generate a unique username');
}

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Connected to database\n');
  } catch (err) {
    console.error('❌ Cannot connect to database:', err.message.split('\n')[0]);
    console.error('   Check that Postgres is running on the host/port shown above.');
    process.exit(1);
  }

  const hospital = await prisma.hospital.findFirst({
  where: { usernamePrefix: 'stmarys' },
  select: { id: true, slug: true, usernamePrefix: true, name: true },
});

  if (!hospital) {
    console.error('❌ Hospital with slug "stmarys" not found. Available hospitals:');
    const all = await prisma.hospital.findMany({
      select: { id: true, name: true, slug: true, usernamePrefix: true },
    });
    console.table(all);
    process.exit(1);
  }

  const prefix = hospital.usernamePrefix || hospital.slug;
  console.log(`→ ${hospital.name}  (id=${hospital.id}, prefix=${prefix})\n`);

  const staff = await prisma.staff.findMany({
    where: { tenantId: hospital.id },
    select: { id: true, username: true, role: true, firstName: true, lastName: true },
  });

  const conforming = new RegExp(`^${prefix}-\\d{4}$`);
  let changed = 0, skipped = 0;

  for (const s of staff) {
    if (conforming.test(s.username)) {
      console.log(`✓ ${s.username}  (already OK)`);
      skipped++;
      continue;
    }
    const newUsername = await generateUsername(prefix, hospital.id);
    await prisma.staff.update({
      where: { id: s.id },
      data: { username: newUsername },
    });
    console.log(`→ ${s.username}  →  ${newUsername}   (${s.firstName} ${s.lastName}, ${s.role})`);
    changed++;
  }

  console.log(`\nDone. ${changed} renamed, ${skipped} skipped.`);
  console.log('⚠️  Tell each renamed staff member their new username.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());