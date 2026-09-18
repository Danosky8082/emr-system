// scripts/add-username-prefixes.js
// One-time migration: assign usernamePrefix to existing hospitals.

require('dotenv').config();
const { prisma } = require('../src/prisma-client');

const PREFIXES = {
  'default-hospital-id': 'caretech',
  'st-marys-hospital-id': 'stmarys',
  'county-general-hospital-id': 'county',
};

async function main() {
  console.log('🔧 Adding usernamePrefix to existing hospitals...\n');

  const hospitals = await prisma.hospital.findMany();

  for (const hospital of hospitals) {
    // Skip if already set
    if (hospital.usernamePrefix) {
      console.log(`⏭️  ${hospital.name}: already has prefix "${hospital.usernamePrefix}"`);
      continue;
    }

    // Determine the prefix
    let prefix = PREFIXES[hospital.id];

    if (!prefix) {
      // Fallback: derive from slug by removing hyphens
      prefix = hospital.slug.replace(/-/g, '').toLowerCase();
      console.log(`⚠️  ${hospital.name}: no explicit prefix, derived "${prefix}" from slug`);
    }

    // Sanity check: prefix must be alphanumeric + hyphens, unique
    if (!/^[a-z0-9][a-z0-9-]*$/.test(prefix)) {
      console.error(`❌ Invalid prefix "${prefix}" for ${hospital.name} — skipping`);
      continue;
    }

    try {
      await prisma.hospital.update({
        where: { id: hospital.id },
        data: { usernamePrefix: prefix },
      });
      console.log(`✅ ${hospital.name}: prefix set to "${prefix}"`);
    } catch (err) {
      if (err.code === 'P2002') {
        console.error(`❌ Prefix "${prefix}" is already taken by another hospital`);
      } else {
        console.error(`❌ Failed for ${hospital.name}:`, err.message);
      }
    }
  }

  console.log('\n🎉 Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());