// scripts/migrate-usernames-to-prefixed.js
require('dotenv').config();
const { prisma } = require('../src/prisma-client');

async function main() {
  console.log('🔄 Migrating staff usernames to prefixed form...\n');

  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true, usernamePrefix: true },
  });

  for (const hospital of hospitals) {
    if (!hospital.usernamePrefix) {
      console.log(`⏭️  ${hospital.name}: no prefix configured, skipping`);
      continue;
    }

    const staff = await prisma.staff.findMany({
      where: { tenantId: hospital.id },
    });

    for (const s of staff) {
      if (s.username.startsWith(`${hospital.usernamePrefix}-`)) {
        continue;
      }

      const newUsername = `${hospital.usernamePrefix}-${s.username}`;

      try {
        await prisma.staff.update({
          where: { id: s.id },
          data: { username: newUsername },
        });
        console.log(`✅ ${hospital.name}: ${s.username} → ${newUsername}`);
      } catch (err) {
        if (err.code === 'P2002') {
          console.error(`❌ Conflict: ${newUsername} already exists`);
        } else {
          console.error(`❌ ${s.username}: ${err.message}`);
        }
      }
    }
  }

  console.log('\n🎉 Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());