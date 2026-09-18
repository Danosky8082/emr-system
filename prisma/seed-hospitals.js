// prisma/seed-hospitals.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');   // or 'bcryptjs' — check your auth code

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding hospitals...\n');

  const hospitals = [
    {
      name: 'NexGen Medical Centre',
      slug: 'nexgen',
      code: 'NEXGEN',
      email: 'info@nexgen.health',
      phone: '+234-800-000-0001',
      address: '12 Broad Street',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      primaryColor: '#0f3460',
      secondaryColor: '#1a4a7a',
      plan: 'trial',
      status: 'active',
      settings: {
        registrationFee: 2000,
        cardFee: 1000,
        consultationFee: 5000,
        currency: 'NGN',
        currencySymbol: '₦',
        timezone: 'Africa/Lagos',
      },
      admin: {
        employeeId: 'ADMIN-NX-001',
        username: 'nexgen-admin',
        firstName: 'NexGen',
        lastName: 'Admin',
        email: 'admin@nexgen.health',
        role: 'Admin',
        password: 'password123',
      },
    },
    {
      name: "St. Mary's Hospital",
      slug: 'st-marys',
      code: 'STMARYS',
      email: 'info@stmarys.health',
      phone: '+234-800-000-0002',
      address: '45 Constitution Avenue',
      city: 'Abuja',
      state: 'FCT',
      country: 'Nigeria',
      primaryColor: '#dc2626',
      secondaryColor: '#991b1b',
      plan: 'trial',
      status: 'active',
      settings: {
        registrationFee: 3000,
        cardFee: 1500,
        consultationFee: 7500,
        currency: 'NGN',
        currencySymbol: '₦',
        timezone: 'Africa/Lagos',
      },
      admin: {
        employeeId: 'ADMIN-SM-001',
        username: 'stmarys-admin',
        firstName: 'Mary',
        lastName: 'Bello',
        email: 'admin@stmarys.health',
        role: 'Admin',
        password: 'password123',
      },
    },
  ];

  for (const h of hospitals) {
    // 1. Check if hospital already exists
    const existing = await prisma.hospital.findUnique({
      where: { slug: h.slug },
    });

    if (existing) {
      console.log(`⏭️  ${h.name} already exists (slug: ${h.slug}) — skipping`);
      continue;
    }

    // 2. Create hospital + settings + admin staff in a transaction
    const created = await prisma.$transaction(async (tx) => {
      // a. Hospital
      const hospital = await tx.hospital.create({
        data: {
          name: h.name,
          slug: h.slug,
          code: h.code,
          email: h.email,
          phone: h.phone,
          address: h.address,
          city: h.city,
          state: h.state,
          country: h.country,
          primaryColor: h.primaryColor,
          secondaryColor: h.secondaryColor,
          plan: h.plan,
          status: h.status,
          isActive: true,
        },
      });

      // b. Settings — note tenantId = hospital.id
      await tx.hospitalSettings.create({
        data: {
          tenantId: hospital.id,       // ← set to hospital id
          hospitalId: hospital.id,
          registrationFee: h.settings.registrationFee,
          cardFee: h.settings.cardFee,
          consultationFee: h.settings.consultationFee,
          currency: h.settings.currency,
          currencySymbol: h.settings.currencySymbol,
          timezone: h.settings.timezone,
        },
      });

      // c. Admin staff
      const hashedPassword = await bcrypt.hash(h.admin.password, 10);
      await tx.staff.create({
        data: {
          tenantId: hospital.id,        // ← critical: scopes staff to hospital
          employeeId: h.admin.employeeId,
          username: h.admin.username,
          firstName: h.admin.firstName,
          lastName: h.admin.lastName,
          email: h.admin.email,
          role: h.admin.role,
          password: hashedPassword,
          isActive: true,
        },
      });

      return hospital;
    });

    console.log(`✅ Created: ${created.name}`);
    console.log(`   ID:     ${created.id}`);
    console.log(`   URL:    http://localhost:5173/h/${created.slug}/login`);
    console.log(`   Login:  ${h.admin.username} / ${h.admin.password}`);
    console.log('');
  }

  console.log('🎉 Seeding complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());