// test-tenant.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  console.log('\n=== MULTI-TENANCY ISOLATION TEST ===\n');

  // 1. Check the default hospital
  const defaultHospital = await prisma.hospital.findUnique({
    where: { id: 'default-hospital-id' }
  });
  console.log('🏥 Default hospital:', defaultHospital?.name || '❌ MISSING');

  // 2. Count existing data assigned to default hospital
  const patientCount = await prisma.patient.count({ where: { tenantId: 'default-hospital-id' } });
  const staffCount = await prisma.staff.count({ where: { tenantId: 'default-hospital-id' } });
  const medicationCount = await prisma.medication.count({ where: { tenantId: 'default-hospital-id' } });
  const auditCount = await prisma.auditLog.count({ where: { tenantId: 'default-hospital-id' } });

  console.log(`👥 Patients in Default Hospital: ${patientCount}`);
  console.log(`👨‍⚕️ Staff in Default Hospital: ${staffCount}`);
  console.log(`💊 Medications in Default Hospital: ${medicationCount}`);
  console.log(`📝 Audit logs in Default Hospital: ${auditCount}`);

  // 3. Create a SECOND hospital (tenant)
  console.log('\n--- Creating second hospital ---');
  const hospital2 = await prisma.hospital.upsert({
    where: { slug: 'test-hospital-two' },
    update: {},
    create: {
      name: 'Test Hospital Two',
      slug: 'test-hospital-two',
      code: 'TST002',
      email: 'admin@test2.local',
      phone: '+234-900-000-0002'
    }
  });
  console.log(`🏥 Created: ${hospital2.name} (${hospital2.id})`);

  // 4. Try creating a patient with the SAME hospitalId as existing patient
  //    Before multi-tenancy: This would FAIL (hospitalId was globally unique)
  //    After multi-tenancy: This should SUCCEED (hospitalId is unique per tenant)
  console.log('\n--- Testing composite uniqueness ---');

  // Get an existing patient's hospitalId
  const existingPatient = await prisma.patient.findFirst({
    where: { tenantId: 'default-hospital-id' }
  });

  if (!existingPatient) {
    console.log('⚠️ No existing patient to test with. Skipping.');
  } else {
    console.log(`📋 Existing patient hospitalId: ${existingPatient.hospitalId} (in Default Hospital)`);

    // Try creating a patient in hospital2 with the SAME hospitalId
    try {
      const p2 = await prisma.patient.create({
        data: {
          tenantId: hospital2.id,
          hospitalId: existingPatient.hospitalId,   // ⚠️ SAME ID
          firstName: 'Test',
          lastName: 'TenantTwo',
          dateOfBirth: new Date('1985-05-15'),
          gender: 'Male'
        }
      });
      console.log(`✅ Created patient in Hospital 2 with SAME hospitalId: ${p2.hospitalId}`);
      console.log(`   🎉 Composite uniqueness works — 2 hospitals can have patient "000001"`);

      // Clean up the test patient
      await prisma.patient.delete({ where: { id: p2.id } });
      console.log('   🧹 Cleaned up test patient');
    } catch (e) {
      console.log(`❌ FAILED: ${e.message}`);
      console.log('   → Composite unique constraint not working!');
    }
  }

  // 5. Test that each hospital sees only its own patients
  console.log('\n--- Testing data isolation ---');
  const patientsH1 = await prisma.patient.findMany({
    where: { tenantId: 'default-hospital-id' },
    select: { firstName: true, lastName: true }
  });
  const patientsH2 = await prisma.patient.findMany({
    where: { tenantId: hospital2.id },
    select: { firstName: true, lastName: true }
  });

  console.log(`📊 Default Hospital sees ${patientsH1.length} patients`);
  console.log(`📊 Test Hospital Two sees ${patientsH2.length} patients`);

  // 6. Clean up the test hospital
  console.log('\n--- Cleanup ---');
  await prisma.hospital.delete({ where: { id: hospital2.id } });
  console.log('🧹 Deleted test hospital');

  console.log('\n=== TEST COMPLETE ===\n');
  await prisma.$disconnect();
})();