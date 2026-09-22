// scripts/check-hospitals.js
// ============================================================
// Diagnostic: show clinic / ward / service / dept counts per hospital
// ============================================================
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hospitals = await prisma.hospital.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      _count: {
        select: {
          Clinic: true,
          Ward: true,
          ServicePricing: true,
          Department: true,
          ServiceConfiguration: true,
          Staff: true,
          Patient: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('');
  console.log('Hospital'.padEnd(32), 'Clinics', 'Wards', 'Services', 'Depts', 'Configs', 'Staff', 'Patients');
  console.log('-'.repeat(95));

  for (const h of hospitals) {
    console.log(
      h.name.padEnd(32),
      String(h._count.Clinic).padStart(7),
      String(h._count.Ward).padStart(5),
      String(h._count.ServicePricing).padStart(8),
      String(h._count.Department).padStart(5),
      String(h._count.ServiceConfiguration).padStart(7),
      String(h._count.Staff).padStart(5),
      String(h._count.Patient).padStart(8)
    );
  }

  console.log('');
  console.log(`Total hospitals: ${hospitals.length}`);
  console.log('');

  // Detailed breakdown per hospital
  for (const h of hospitals) {
    console.log(`\n── ${h.name} (${h.slug}) ──`);
    console.log(`   Plan: ${h.plan} | Status: ${h.status}`);

    const clinics = await prisma.clinic.findMany({
      where: { tenantId: h.id },
      select: { name: true },
      take: 5,
    });
    console.log(`   Clinics (${h._count.Clinic}): ${clinics.map(c => c.name).join(', ')}${h._count.Clinic > 5 ? '...' : ''}`);

    const wards = await prisma.ward.findMany({
      where: { tenantId: h.id },
      select: { name: true },
      take: 5,
    });
    console.log(`   Wards (${h._count.Ward}): ${wards.map(w => w.name).join(', ')}${h._count.Ward > 5 ? '...' : ''}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });