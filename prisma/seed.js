// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:12345678@127.0.0.1:5433/emr_db?schema=public',
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Create departments first
    console.log('📋 Creating departments...');

    const adminDept = await prisma.department.upsert({
      where: { name: 'Administration' },
      update: {},
      create: {
        name: 'Administration',
        description: 'Hospital Administration Department',
        location: 'Main Building',
        isActive: true,
      },
    });

    const hrDept = await prisma.department.upsert({
      where: { name: 'Human Resources' },
      update: {},
      create: {
        name: 'Human Resources',
        description: 'HR Department',
        location: 'Main Building, 2nd Floor',
        isActive: true,
      },
    });

    const medicalDept = await prisma.department.upsert({
      where: { name: 'Medical' },
      update: {},
      create: {
        name: 'Medical',
        description: 'Medical Department',
        location: 'Wing A',
        isActive: true,
      },
    });

    const nursingDept = await prisma.department.upsert({
      where: { name: 'Nursing' },
      update: {},
      create: {
        name: 'Nursing',
        description: 'Nursing Department',
        location: 'Wing B',
        isActive: true,
      },
    });

    const pharmacyDept = await prisma.department.upsert({
      where: { name: 'Pharmacy' },
      update: {},
      create: {
        name: 'Pharmacy',
        description: 'Pharmacy Department',
        location: 'Ground Floor',
        isActive: true,
      },
    });

    const labDept = await prisma.department.upsert({
      where: { name: 'Laboratory' },
      update: {},
      create: {
        name: 'Laboratory',
        description: 'Laboratory Department',
        location: 'Wing C',
        isActive: true,
      },
    });

    const radiologyDept = await prisma.department.upsert({
      where: { name: 'Radiology' },
      update: {},
      create: {
        name: 'Radiology',
        description: 'Radiology Department',
        location: 'Wing D',
        isActive: true,
      },
    });

    const financeDept = await prisma.department.upsert({
      where: { name: 'Finance' },
      update: {},
      create: {
        name: 'Finance',
        description: 'Finance Department',
        location: 'Main Building, 1st Floor',
        isActive: true,
      },
    });

    const recordsDept = await prisma.department.upsert({
      where: { name: 'Records' },
      update: {},
      create: {
        name: 'Records',
        description: 'Medical Records Department',
        location: 'Wing B, Ground Floor',
        isActive: true,
      },
    });

    console.log('✅ Departments created');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.staff.upsert({
      where: { email: 'admin@hospital.com' },
      update: {},
      create: {
        employeeId: 'ADMIN001',
        username: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@hospital.com',
        role: 'Admin',
        departmentId: adminDept.id,
        password: hashedPassword,
        isActive: true,
        employmentType: 'Full-time',
      },
    });
    console.log('✅ Created admin user');

    // Create HR user
    const hrPassword = await bcrypt.hash('hr123', 10);
    await prisma.staff.upsert({
      where: { email: 'hr@hospital.com' },
      update: {},
      create: {
        employeeId: 'HR001',
        username: 'hr',
        firstName: 'HR',
        lastName: 'Manager',
        email: 'hr@hospital.com',
        role: 'HR',
        departmentId: hrDept.id,
        password: hrPassword,
        isActive: true,
        employmentType: 'Full-time',
      },
    });
    console.log('✅ Created HR user');

    // Create doctor user
    const doctorPassword = await bcrypt.hash('doctor123', 10);
    await prisma.staff.upsert({
      where: { email: 'doctor@hospital.com' },
      update: {},
      create: {
        employeeId: 'DOC001',
        username: 'doctor',
        firstName: 'John',
        lastName: 'Doctor',
        email: 'doctor@hospital.com',
        role: 'Doctor',
        departmentId: medicalDept.id,
        password: doctorPassword,
        isActive: true,
        employmentType: 'Full-time',
      },
    });
    console.log('✅ Created Doctor user');

    // Create nurse user
    const nursePassword = await bcrypt.hash('nurse123', 10);
    await prisma.staff.upsert({
      where: { email: 'nurse@hospital.com' },
      update: {},
      create: {
        employeeId: 'NURSE001',
        username: 'nurse',
        firstName: 'Sarah',
        lastName: 'Nurse',
        email: 'nurse@hospital.com',
        role: 'Nurse',
        departmentId: nursingDept.id,
        password: nursePassword,
        isActive: true,
        employmentType: 'Full-time',
      },
    });
    console.log('✅ Created Nurse user');

    // Create radiologist user
    const radPassword = await bcrypt.hash('rad123', 10);
    await prisma.staff.upsert({
      where: { email: 'radiologist@hospital.com' },
      update: {},
      create: {
        employeeId: 'RAD001',
        username: 'radiologist',
        firstName: 'Radiology',
        lastName: 'Specialist',
        email: 'radiologist@hospital.com',
        role: 'Radiologist',
        departmentId: radiologyDept.id,
        password: radPassword,
        isActive: true,
        employmentType: 'Full-time',
      },
    });
    console.log('✅ Created Radiologist user');

    // Create a test patient
    await prisma.patient.upsert({
      where: { email: 'john.oye@gmail.com' },
      update: {},
      create: {
        hospitalId: '000001',
        firstName: 'John',
        lastName: 'Oyelakin',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'Male',
        phone: '08012345678',
        email: 'john.oye@gmail.com',
        address: '123 Main Street, Lagos',
        emergencyContact: '08087654321',
        nextOfKinName: 'Hannah Oyelakin',
        nextOfKinPhone: '08087654321',
        nextOfKinRelationship: 'Spouse',
        patientCategory: 'FPP',
      },
    });
    console.log('✅ Created patient');

    // Create role permissions
    const roles = ['Admin', 'ITAdmin', 'Doctor', 'Nurse', 'Pharmacist', 'Accountant', 'Records', 'LabTechnician', 'Receptionist', 'BillingOfficer', 'Obstetrician', 'Midwife', 'Radiologist', 'HR'];

    for (const role of roles) {
      await prisma.rolePermission.upsert({
        where: { role },
        update: {},
        create: {
          role,
          dashboard: true,
          patients: ['Admin', 'ITAdmin', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Radiologist', 'Records', 'BillingOfficer'].includes(role),
          staff: ['Admin', 'ITAdmin', 'HR'].includes(role),
          appointments: ['Admin', 'ITAdmin', 'Doctor', 'Obstetrician', 'Receptionist'].includes(role),
          prescriptions: ['Admin', 'ITAdmin', 'Doctor', 'Obstetrician', 'Pharmacist'].includes(role),
          labOrders: ['Admin', 'ITAdmin', 'Doctor', 'Obstetrician', 'LabTechnician'].includes(role),
          billing: ['Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'].includes(role),
          pharmacy: ['Admin', 'ITAdmin', 'Pharmacist'].includes(role),
          pharmacyDashboard: ['Admin', 'ITAdmin', 'Pharmacist'].includes(role),
          pharmacyInventory: ['Admin', 'ITAdmin', 'Pharmacist'].includes(role),
          nhisManagement: ['Admin', 'ITAdmin', 'Accountant'].includes(role),
          nhisAuthorizations: ['Admin', 'ITAdmin', 'Pharmacist'].includes(role),
          pharmacyStock: ['Admin', 'ITAdmin', 'Pharmacist'].includes(role),
          pharmacyTransactions: ['Admin', 'ITAdmin', 'Pharmacist'].includes(role),
          pharmacyBranches: ['Admin', 'ITAdmin'].includes(role),
          clinics: ['Admin', 'ITAdmin'].includes(role),
          wards: ['Admin', 'ITAdmin'].includes(role),
          pricing: ['Admin', 'ITAdmin', 'Accountant'].includes(role),
          billingOfficer: ['Admin', 'ITAdmin', 'BillingOfficer'].includes(role),
          patientIntake: ['Admin', 'ITAdmin', 'Records'].includes(role),
          admissions: ['Admin', 'ITAdmin', 'Records'].includes(role),
          patientHistory: ['Admin', 'ITAdmin', 'Records'].includes(role),
          roiRequests: ['Admin', 'ITAdmin', 'Records'].includes(role),
          nurseDashboard: ['Admin', 'ITAdmin', 'Nurse', 'Midwife'].includes(role),
          doctorDashboard: ['Admin', 'ITAdmin', 'Doctor', 'Obstetrician'].includes(role),
          antenatal: ['Admin', 'ITAdmin', 'Obstetrician', 'Midwife', 'Records'].includes(role),
          archivedPatients: ['Admin', 'ITAdmin', 'Records', 'HR'].includes(role),
          archivedPatientsView: ['Admin', 'ITAdmin', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Records', 'HR', 'Radiologist'].includes(role),
          queueManagement: ['Admin', 'ITAdmin', 'Records', 'Nurse', 'Midwife', 'HR'].includes(role),
          doctorQueue: ['Admin', 'ITAdmin', 'Doctor', 'Obstetrician'].includes(role),
          hrDashboard: ['Admin', 'ITAdmin', 'HR'].includes(role),
          hrEmployees: ['Admin', 'ITAdmin', 'HR'].includes(role),
          hrDepartments: ['Admin', 'ITAdmin', 'HR'].includes(role),
          hrLeaves: ['Admin', 'ITAdmin', 'HR'].includes(role),
          hrAttendance: ['Admin', 'ITAdmin', 'HR'].includes(role),
          hrPerformance: ['Admin', 'ITAdmin', 'HR'].includes(role),
          hrTrainings: ['Admin', 'ITAdmin', 'HR'].includes(role),
        },
      });
    }
    console.log(`✅ Created permissions for ${roles.length} roles`);

    console.log('🌱 Seeding complete!');
    console.log('📋 Login credentials:');
    console.log('  Admin:    admin@hospital.com / admin123');
    console.log('  HR:       hr@hospital.com / hr123');
    console.log('  Doctor:   doctor@hospital.com / doctor123');
    console.log('  Nurse:    nurse@hospital.com / nurse123');
    console.log('  Radiologist: radiologist@hospital.com / rad123');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });