// prisma/seed.js — COMPLETE MULTI-TENANT SEED
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { createDefaultHospitalData } = require('../src/hospital-templates');
const { createDefaultRolePermissions } = require('../src/permission-templates');

const DEFAULT_TENANT_ID = 'default-hospital-id';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://postgres:12345678@127.0.0.1:5433/emr_db?schema=public',
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database (multi-tenant)...');
  console.log(`🏢 Default tenant: ${DEFAULT_TENANT_ID}\n`);

  const now = new Date();
  const T = DEFAULT_TENANT_ID;

  try {
    // ============================================================
    // 0. HOSPITALS (TENANTS) — must exist first
    // ============================================================
    console.log('🏥 Hospitals (tenants)...');

    const HOSPITALS = [
      {
        id: 'default-hospital-id',
        name: 'CareTech General Hospital',
        slug: 'default-hospital',
        code: 'DEFAULT-HOSP',
        usernamePrefix: 'caretech',
        email: 'info@hospital.com',
        phone: '08000000000',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        primaryColor: '#0f3460',
        secondaryColor: '#1a4a7a',
      },
      {
        id: 'st-marys-hospital-id',
        name: "St. Mary's Hospital",
        slug: 'st-marys',
        code: 'STMARYS',
        usernamePrefix: 'stmarys',
        email: 'info@stmarys.health',
        phone: '08000000002',
        city: 'Abuja',
        state: 'FCT',
        country: 'Nigeria',
        primaryColor: '#dc2626',
        secondaryColor: '#991b1b',
      },
    ];

    for (const h of HOSPITALS) {
      await prisma.hospital.upsert({
        where: { id: h.id },
        update: { updatedAt: now },
        create: {
          ...h,
          plan: 'trial',
          status: 'active',
          isActive: true,
        },
      });
      console.log(`  ✅ ${h.name} (${h.slug})`);
    }

    // ============================================================
    // 1. HOSPITAL SETTINGS — one per hospital
    // ============================================================
    console.log('\n⚙️  Hospital settings...');

    const SETTINGS_PER_HOSPITAL = {
      'default-hospital-id': {
        registrationFee: 2000,
        cardFee: 1000,
        consultationFee: 5000,
      },
      'st-marys-hospital-id': {
        registrationFee: 3000,
        cardFee: 1500,
        consultationFee: 7500,
      },
    };

    for (const [hospitalId, s] of Object.entries(SETTINGS_PER_HOSPITAL)) {
      await prisma.hospitalSettings.upsert({
        where: { tenantId: hospitalId },
        update: { ...s, updatedAt: now },
        create: {
          tenantId: hospitalId,
          hospitalId,
          ...s,
          nhisMultiplier: 0.1,
          retainerMultiplier: 2.0,
          autoArchiveHours: 24,
          appointmentDuration: 30,
          enablePatientPortal: true,
          enableKioskMode: true,
          currency: 'NGN',
          currencySymbol: '₦',
          timezone: 'Africa/Lagos',
        },
      });
      console.log(`  ✅ Settings for ${hospitalId}`);
    }

    // ============================================================
    // 2. STARTER DATA FOR EVERY HOSPITAL
    //    (clinics, wards, departments, service pricing, service configs)
    //    Idempotent: wipes and recreates so re-running the seed is safe.
    // ============================================================
    console.log('\n📦 Starter data for every hospital...');

    for (const h of HOSPITALS) {
      // Wipe existing starter data for idempotent re-seed
      await prisma.clinic.deleteMany({ where: { tenantId: h.id } });
      await prisma.ward.deleteMany({ where: { tenantId: h.id } });
      await prisma.department.deleteMany({ where: { tenantId: h.id } });
      await prisma.servicePricing.deleteMany({ where: { tenantId: h.id } });
      await prisma.serviceConfiguration.deleteMany({ where: { tenantId: h.id } });

      const created = await prisma.$transaction(async (tx) => {
        return await createDefaultHospitalData(tx, h.id);
      });

      console.log(
        `  ✅ ${h.name}: ` +
        `${created.clinics} clinics, ` +
        `${created.wards} wards, ` +
        `${created.departments} departments, ` +
        `${created.services} services, ` +
        `${created.configs} configs`
      );
    }

    // ============================================================
    // 3. MEDICATIONS (default hospital only)
    // ============================================================
    console.log('\n💊 Medications...');

    const medications = [
      // Antibiotics
      ['Amoxicillin 500mg Capsule', 'Amoxicillin', 'Antibiotic', 'Emzor', 500, 1000, 50],
      ['Amoxicillin-Clavulanate 625mg Tablet', 'Co-amoxiclav', 'Antibiotic', 'GSK', 800, 500, 30],
      ['Ciprofloxacin 500mg Tablet', 'Ciprofloxacin', 'Antibiotic', 'Bayer', 600, 500, 30],
      ['Metronidazole 400mg Tablet', 'Metronidazole', 'Antibiotic', 'Sanofi', 300, 800, 40],
      ['Doxycycline 100mg Capsule', 'Doxycycline', 'Antibiotic', 'Pfizer', 400, 400, 25],
      ['Azithromycin 500mg Tablet', 'Azithromycin', 'Antibiotic', 'Pfizer', 700, 300, 20],
      ['Ceftriaxone 1g Injection', 'Ceftriaxone', 'Antibiotic', 'Roche', 1500, 200, 15],
      ['Gentamicin 80mg Injection', 'Gentamicin', 'Antibiotic', 'AstraZeneca', 800, 200, 15],
      ['Cloxacillin 500mg Capsule', 'Cloxacillin', 'Antibiotic', 'Emzor', 450, 400, 25],
      ['Erythromycin 250mg Tablet', 'Erythromycin', 'Antibiotic', 'Abbott', 350, 300, 20],
      ['Cefuroxime 500mg Tablet', 'Cefuroxime', 'Antibiotic', 'GSK', 650, 300, 20],
      ['Levofloxacin 500mg Tablet', 'Levofloxacin', 'Antibiotic', 'Bayer', 550, 300, 20],
      ['Clarithromycin 500mg Tablet', 'Clarithromycin', 'Antibiotic', 'Abbott', 750, 300, 20],
      ['Amikacin 500mg Injection', 'Amikacin', 'Antibiotic', 'AstraZeneca', 1200, 150, 10],
      ['Meropenem 1g Injection', 'Meropenem', 'Antibiotic', 'Pfizer', 2500, 100, 5],

      // Antihypertensives
      ['Amlodipine 5mg Tablet', 'Amlodipine', 'Antihypertensive', 'Pfizer', 300, 500, 30],
      ['Lisinopril 10mg Tablet', 'Lisinopril', 'Antihypertensive', 'AstraZeneca', 350, 400, 25],
      ['Losartan 50mg Tablet', 'Losartan', 'Antihypertensive', 'MSD', 400, 400, 25],
      ['Atenolol 50mg Tablet', 'Atenolol', 'Antihypertensive', 'GSK', 250, 500, 30],
      ['Hydrochlorothiazide 25mg Tablet', 'Hydrochlorothiazide', 'Antihypertensive', 'Sanofi', 200, 500, 30],
      ['Nifedipine 20mg Tablet', 'Nifedipine', 'Antihypertensive', 'Bayer', 450, 300, 20],
      ['Enalapril 5mg Tablet', 'Enalapril', 'Antihypertensive', 'MSD', 300, 400, 25],
      ['Ramipril 5mg Tablet', 'Ramipril', 'Antihypertensive', 'Aventis', 350, 400, 25],
      ['Telmisartan 40mg Tablet', 'Telmisartan', 'Antihypertensive', 'Boehringer', 450, 300, 20],
      ['Metoprolol 50mg Tablet', 'Metoprolol', 'Antihypertensive', 'AstraZeneca', 300, 400, 25],

      // Antidiabetics
      ['Metformin 500mg Tablet', 'Metformin', 'Antidiabetic', 'MSD', 250, 500, 30],
      ['Glibenclamide 5mg Tablet', 'Glibenclamide', 'Antidiabetic', 'Sanofi', 200, 400, 25],
      ['Insulin NPH 100IU/ml Injection', 'Insulin NPH', 'Antidiabetic', 'Novo Nordisk', 3000, 200, 15],
      ['Insulin Regular 100IU/ml Injection', 'Insulin Regular', 'Antidiabetic', 'Novo Nordisk', 3000, 200, 15],
      ['Pioglitazone 15mg Tablet', 'Pioglitazone', 'Antidiabetic', 'Takeda', 350, 300, 20],
      ['Gliclazide 80mg Tablet', 'Gliclazide', 'Antidiabetic', 'Servier', 300, 300, 20],
      ['Sitagliptin 100mg Tablet', 'Sitagliptin', 'Antidiabetic', 'MSD', 800, 200, 15],
      ['Empagliflozin 25mg Tablet', 'Empagliflozin', 'Antidiabetic', 'Boehringer', 900, 200, 15],

      // Pain Relievers
      ['Paracetamol 500mg Tablet', 'Paracetamol', 'Pain Reliever', 'Emzor', 100, 1000, 50],
      ['Ibuprofen 400mg Tablet', 'Ibuprofen', 'Pain Reliever', 'Pfizer', 200, 500, 30],
      ['Diclofenac 50mg Tablet', 'Diclofenac', 'Pain Reliever', 'Novartis', 250, 400, 25],
      ['Tramadol 50mg Capsule', 'Tramadol', 'Pain Reliever', 'Grünenthal', 350, 300, 20],
      ['Pethidine 100mg Injection', 'Pethidine', 'Pain Reliever', 'AstraZeneca', 1200, 100, 10],
      ['Morphine 10mg Injection', 'Morphine', 'Pain Reliever', 'AstraZeneca', 1500, 100, 10],

      // Psychiatric
      ['Diazepam 5mg Tablet', 'Diazepam', 'Psychiatric', 'Roche', 350, 200, 15],
      ['Alprazolam 0.5mg Tablet', 'Alprazolam', 'Psychiatric', 'Pfizer', 300, 200, 15],
      ['Olanzapine 10mg Tablet', 'Olanzapine', 'Psychiatric', 'Eli Lilly', 800, 150, 10],
      ['Clozapine 100mg Tablet', 'Clozapine', 'Psychiatric', 'Novartis', 900, 150, 10],
      ['Lithium 400mg Tablet', 'Lithium', 'Psychiatric', 'GSK', 450, 200, 15],

      // Emergency
      ['Adrenaline 1mg Injection', 'Adrenaline', 'Emergency', 'AstraZeneca', 1000, 100, 10],
      ['Atropine 1mg Injection', 'Atropine', 'Emergency', 'AstraZeneca', 800, 100, 10],
      ['Naloxone 0.4mg Injection', 'Naloxone', 'Emergency', 'Pfizer', 1200, 100, 10],
      ['Dextrose 50% Injection', 'Dextrose', 'Emergency', 'Baxter', 1500, 100, 10],
      ['Calcium Gluconate 10% Injection', 'Calcium Gluconate', 'Emergency', 'AstraZeneca', 900, 100, 10],
      ['Sodium Bicarbonate 8.4% Injection', 'Sodium Bicarbonate', 'Emergency', 'Baxter', 1000, 100, 10],
      ['Hydrocortisone 100mg Injection', 'Hydrocortisone', 'Emergency', 'Pfizer', 1300, 100, 10],
      ['Chlorpheniramine 10mg Injection', 'Chlorpheniramine', 'Emergency', 'Sanofi', 500, 150, 10],

      // Ophthalmic
      ['Chloramphenicol Eye Drops', 'Chloramphenicol', 'Ophthalmic', 'Bausch', 1500, 200, 15],
      ['Timolol Eye Drops 0.5%', 'Timolol', 'Ophthalmic', 'MSD', 2000, 150, 10],
      ['Artificial Tears', 'Hypromellose', 'Ophthalmic', 'Bausch', 1000, 200, 15],
      ['Latanoprost Eye Drops', 'Latanoprost', 'Ophthalmic', 'Pfizer', 3000, 100, 10],
      ['Dorzolamide Eye Drops', 'Dorzolamide', 'Ophthalmic', 'MSD', 2500, 100, 10],

      // Topical
      ['Hydrocortisone Cream 1%', 'Hydrocortisone', 'Topical', 'Pfizer', 800, 200, 15],
      ['Betamethasone Cream 0.1%', 'Betamethasone', 'Topical', 'GSK', 900, 200, 15],
      ['Neomycin Cream', 'Neomycin', 'Topical', 'Bayer', 600, 200, 15],
      ['Silver Sulphadiazine Cream', 'Silver Sulphadiazine', 'Topical', 'AstraZeneca', 1200, 150, 10],
      ['Ketoconazole Cream', 'Ketoconazole', 'Topical', 'Janssen', 1000, 150, 10],
      ['Acyclovir Cream', 'Acyclovir', 'Topical', 'GSK', 1500, 150, 10],
      ['Retinoic Acid Cream', 'Tretinoin', 'Topical', 'Janssen', 2000, 100, 10],
    ];

    const expiryDate = new Date('2026-12-31');
    for (const [name, genericName, category, supplier, unitPrice, stockQuantity, reorderLevel] of medications) {
      const existing = await prisma.medication.findFirst({
        where: { tenantId: T, name },
      });
      if (existing) {
        await prisma.medication.update({
          where: { id: existing.id },
          data: { genericName, category, supplier, unitPrice, stockQuantity, reorderLevel, updatedAt: now },
        });
      } else {
        await prisma.medication.create({
          data: {
            tenantId: T,
            name, genericName, category, supplier,
            unitPrice, stockQuantity, reorderLevel,
            expiryDate,
            batchNumber: `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          },
        });
      }
    }
    console.log(`  ✅ ${medications.length} medications`);

    // ============================================================
    // 4. STAFF USERS (default hospital)
    // ============================================================
    console.log('\n👤 Staff users...');

    const staffUsers = [
      ['ADMIN001', 'admin', 'System', 'Administrator', 'admin@hospital.com', 'Admin', 'admin123'],
      ['IT001', 'itadmin', 'IT', 'Admin', 'itadmin@hospital.com', 'ITAdmin', 'admin123'],
      ['HR001', 'hr', 'HR', 'Manager', 'hr@hospital.com', 'HR', 'hr123'],
      ['DOC001', 'doctor', 'John', 'Doctor', 'doctor@hospital.com', 'Doctor', 'doctor123'],
      ['NURSE001', 'nurse', 'Sarah', 'Nurse', 'nurse@hospital.com', 'Nurse', 'nurse123'],
      ['BILL001', 'billing', 'Billing', 'Officer', 'billing@hospital.com', 'BillingOfficer', 'billing123'],
      ['PHARM001', 'pharmacist', 'Pharmacy', 'Staff', 'pharmacist@hospital.com', 'Pharmacist', 'pharm123'],
      ['LAB001', 'labtech', 'Lab', 'Technician', 'labtech@hospital.com', 'LabTechnician', 'lab123'],
      ['LABSCI001', 'labscientist', 'Lab', 'Scientist', 'labscientist@hospital.com', 'LabScientist', 'labsci123'],
      ['RAD001', 'radiologist', 'Radiology', 'Specialist', 'radiologist@hospital.com', 'Radiologist', 'rad123'],
      ['ACC001', 'accountant', 'Account', 'Ant', 'accountant@hospital.com', 'Accountant', 'acc123'],
      ['REC001', 'records', 'Records', 'Officer', 'records@hospital.com', 'Records', 'records123'],
      ['OBG001', 'obstetrician', 'Obstetrics', 'Specialist', 'obstetrician@hospital.com', 'Obstetrician', 'obg123'],
      ['MID001', 'midwife', 'Midwife', 'Staff', 'midwife@hospital.com', 'Midwife', 'mid123'],
      ['RECEPT001', 'receptionist', 'Reception', 'Staff', 'receptionist@hospital.com', 'Receptionist', 'recept123'],
    ];

    const CARETECH_PREFIX = 'caretech';
    for (const [employeeId, username, firstName, lastName, email, role, password] of staffUsers) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const fullUsername = `${CARETECH_PREFIX}-${username}`;
      await prisma.staff.upsert({
        where: { tenantId_employeeId: { tenantId: T, employeeId } },
        update: {
          username: fullUsername,
          firstName, lastName, email, role,
          isActive: true, updatedAt: now,
        },
        create: {
          tenantId: T, employeeId,
          username: fullUsername,
          firstName, lastName, email, role,
          password: hashedPassword, isActive: true, updatedAt: now,
        },
      });
    }
    console.log(`  ✅ ${staffUsers.length} staff`);

    // ============================================================
    // 4b. ADMIN STAFF FOR ST. MARY'S
    // ============================================================
    console.log('\n👤 St. Mary\'s admin...');

    const stMarysAdmin = {
      employeeId: 'ADMIN-SM-001',
      username: 'stmarys-admin',
      firstName: 'Mary',
      lastName: 'Bello',
      email: 'admin@stmarys.health',
      role: 'Admin',
      password: 'password123',
      tenantId: 'st-marys-hospital-id',
    };

    {
      const hashedPassword = await bcrypt.hash(stMarysAdmin.password, 10);
      await prisma.staff.upsert({
        where: {
          tenantId_employeeId: {
            tenantId: stMarysAdmin.tenantId,
            employeeId: stMarysAdmin.employeeId,
          },
        },
        update: {
          username: stMarysAdmin.username,
          firstName: stMarysAdmin.firstName,
          lastName: stMarysAdmin.lastName,
          email: stMarysAdmin.email,
          role: stMarysAdmin.role,
          isActive: true,
          updatedAt: now,
        },
        create: {
          tenantId: stMarysAdmin.tenantId,
          employeeId: stMarysAdmin.employeeId,
          username: stMarysAdmin.username,
          firstName: stMarysAdmin.firstName,
          lastName: stMarysAdmin.lastName,
          email: stMarysAdmin.email,
          role: stMarysAdmin.role,
          password: hashedPassword,
          isActive: true,
          updatedAt: now,
        },
      });
      console.log(`  ✅ ${stMarysAdmin.username} / ${stMarysAdmin.password}`);
    }

    // ============================================================
    // 5. ROLE PERMISSIONS — for EVERY hospital
    // ============================================================
    console.log('\n🔐 Role permissions...');

    for (const h of HOSPITALS) {
      await prisma.rolePermission.deleteMany({ where: { tenantId: h.id } });
      const rolesCreated = await prisma.$transaction(async (tx) => {
        return await createDefaultRolePermissions(tx, h.id);
      });
      console.log(`  ✅ ${h.name}: ${rolesCreated} roles`);
    }

    // ============================================================
    // 6. TEST PATIENT (default hospital)
    // ============================================================
    console.log('\n👤 Test patient...');
    await prisma.patient.upsert({
      where: { tenantId_hospitalId: { tenantId: T, hospitalId: '000001' } },
      update: { updatedAt: now },
      create: {
        tenantId: T, hospitalId: '000001',
        firstName: 'John', lastName: 'Oyelakin',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'Male', phone: '08012345678',
        email: 'john.oye@gmail.com', address: '123 Main Street, Lagos',
        emergencyContact: '08087654321',
        nextOfKinName: 'Hannah Oyelakin',
        nextOfKinPhone: '08087654321',
        nextOfKinRelationship: 'Spouse',
        patientCategory: 'FPP',
      },
    });
    const testPatient = await prisma.patient.findUnique({
      where: { tenantId_hospitalId: { tenantId: T, hospitalId: '000001' } },
    });
    if (testPatient) {
      await prisma.patientWallet.upsert({
        where: { patientId: testPatient.id },
        update: { updatedAt: now },
        create: { patientId: testPatient.id, balance: 15000, status: 'Active', tenantId: T, updatedAt: now },
      });
    }
    console.log('  ✅ Patient + Wallet');

    // ============================================================
    // DONE
    // ============================================================
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎉 SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    for (const h of HOSPITALS) {
      console.log(`🏢 ${h.name} (${h.slug})`);
      console.log(`   Login URL: /h/${h.slug}/login`);
    }
    console.log('');
    console.log('📋 LOGIN CREDENTIALS (CareTech):');
    console.log('  Admin:   admin@hospital.com / admin123');
    console.log('  Doctor:  doctor@hospital.com / doctor123');
    console.log('  Nurse:   nurse@hospital.com / nurse123');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS (St. Mary\'s):');
    console.log('  Admin:   stmarys-admin / password123');
    console.log('═══════════════════════════════════════════════════');

    // ============================================================
    // 7. PLATFORM USER (SaaS operator)
    // ============================================================
    console.log('\n🔐 Platform users...');
    {
      const platformPassword = await bcrypt.hash('platform123', 10);
      await prisma.platformUser.upsert({
        where: { username: 'platform-admin' },
        update: {},
        create: {
          username: 'platform-admin',
          email: 'admin@nexgen.health',
          password: platformPassword,
          firstName: 'Platform',
          lastName: 'Owner',
          role: 'PlatformAdmin',
          isActive: true,
        },
      });
      console.log('  ✅ platform-admin / platform123');
    }
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });