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

// Pass the adapter to PrismaClient constructor
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  try {
    const now = new Date();

    // ============================================================
    // 1. Create Service Configurations
    // ============================================================
    console.log('💰 Seeding Service Configurations...');

    const serviceConfigs = [
      {
        serviceType: 'REGISTRATION',
        name: 'Registration Fee',
        description: 'One-time registration fee for new patients',
        baseAmount: 2000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        serviceType: 'CARD',
        name: 'ID Card Fee',
        description: 'Patient identification card fee',
        baseAmount: 1000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        serviceType: 'CONSULTATION',
        name: 'Consultation Fee',
        description: 'Standard consultation fee',
        baseAmount: 5000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const config of serviceConfigs) {
      await prisma.serviceConfiguration.upsert({
        where: { serviceType: config.serviceType },
        update: config,
        create: config,
      });
      console.log(`  ✅ ${config.serviceType}: ₦${config.baseAmount.toLocaleString()}`);
    }

    // ============================================================
    // 2. Create Clinics
    // ============================================================
    console.log('🏥 Creating clinics...');

    const clinics = [
      { name: 'General Outpatient', description: 'General outpatient services', location: 'Ground Floor, Block A', isActive: true, createdAt: now, updatedAt: now },
      { name: 'Paediatrics', description: 'Paediatric care for children', location: 'First Floor, Block B', isActive: true, createdAt: now, updatedAt: now },
      { name: 'Obstetrics & Gynaecology', description: 'Women\'s health and maternity', location: 'Second Floor, Block A', isActive: true, createdAt: now, updatedAt: now },
      { name: 'Internal Medicine', description: 'Adult medical care', location: 'Ground Floor, Block C', isActive: true, createdAt: now, updatedAt: now },
      { name: 'Surgery', description: 'Surgical consultations', location: 'First Floor, Block C', isActive: true, createdAt: now, updatedAt: now },
    ];

    for (const clinic of clinics) {
      await prisma.clinic.upsert({
        where: { name: clinic.name },
        update: clinic,
        create: clinic,
      });
      console.log(`  ✅ Clinic: ${clinic.name}`);
    }

    // ============================================================
    // 3. Create Wards
    // ============================================================
    console.log('🛏️ Creating wards...');

    const wards = [
      { name: 'General Ward', description: 'General inpatient ward', capacity: 30, createdAt: now, updatedAt: now },
      { name: 'Maternity Ward', description: 'Maternity and postnatal care', capacity: 20, createdAt: now, updatedAt: now },
      { name: 'Paediatric Ward', description: 'Children\'s inpatient ward', capacity: 15, createdAt: now, updatedAt: now },
      { name: 'Surgical Ward', description: 'Post-surgical recovery', capacity: 25, createdAt: now, updatedAt: now },
      { name: 'Private Ward', description: 'Private rooms for patients', capacity: 10, createdAt: now, updatedAt: now },
    ];

    for (const ward of wards) {
      await prisma.ward.upsert({
        where: { name: ward.name },
        update: ward,
        create: ward,
      });
      console.log(`  ✅ Ward: ${ward.name}`);
    }

    // ============================================================
    // 4. Create Staff Users
    // ============================================================
    console.log('👤 Creating staff users...');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const staffUsers = [
      {
        employeeId: 'ADMIN001',
        username: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@hospital.com',
        role: 'Admin',
        password: hashedPassword,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'IT001',
        username: 'itadmin',
        firstName: 'IT',
        lastName: 'Admin',
        email: 'itadmin@hospital.com',
        role: 'ITAdmin',
        password: hashedPassword,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'HR001',
        username: 'hr',
        firstName: 'HR',
        lastName: 'Manager',
        email: 'hr@hospital.com',
        role: 'HR',
        password: await bcrypt.hash('hr123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'DOC001',
        username: 'doctor',
        firstName: 'John',
        lastName: 'Doctor',
        email: 'doctor@hospital.com',
        role: 'Doctor',
        password: await bcrypt.hash('doctor123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'NURSE001',
        username: 'nurse',
        firstName: 'Sarah',
        lastName: 'Nurse',
        email: 'nurse@hospital.com',
        role: 'Nurse',
        password: await bcrypt.hash('nurse123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'BILL001',
        username: 'billing',
        firstName: 'Billing',
        lastName: 'Officer',
        email: 'billing@hospital.com',
        role: 'BillingOfficer',
        password: await bcrypt.hash('billing123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'PHARM001',
        username: 'pharmacist',
        firstName: 'Pharmacy',
        lastName: 'Staff',
        email: 'pharmacist@hospital.com',
        role: 'Pharmacist',
        password: await bcrypt.hash('pharm123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'LAB001',
        username: 'labtech',
        firstName: 'Lab',
        lastName: 'Technician',
        email: 'labtech@hospital.com',
        role: 'LabTechnician',
        password: await bcrypt.hash('lab123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'LABSCI001',
        username: 'labscientist',
        firstName: 'Lab',
        lastName: 'Scientist',
        email: 'labscientist@hospital.com',
        role: 'LabScientist',
        password: await bcrypt.hash('labsci123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'RAD001',
        username: 'radiologist',
        firstName: 'Radiology',
        lastName: 'Specialist',
        email: 'radiologist@hospital.com',
        role: 'Radiologist',
        password: await bcrypt.hash('rad123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'ACC001',
        username: 'accountant',
        firstName: 'Account',
        lastName: 'Ant',
        email: 'accountant@hospital.com',
        role: 'Accountant',
        password: await bcrypt.hash('acc123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'REC001',
        username: 'records',
        firstName: 'Records',
        lastName: 'Officer',
        email: 'records@hospital.com',
        role: 'Records',
        password: await bcrypt.hash('records123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'OBG001',
        username: 'obstetrician',
        firstName: 'Obstetrics',
        lastName: 'Specialist',
        email: 'obstetrician@hospital.com',
        role: 'Obstetrician',
        password: await bcrypt.hash('obg123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'MID001',
        username: 'midwife',
        firstName: 'Midwife',
        lastName: 'Staff',
        email: 'midwife@hospital.com',
        role: 'Midwife',
        password: await bcrypt.hash('mid123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        employeeId: 'RECEPT001',
        username: 'receptionist',
        firstName: 'Reception',
        lastName: 'Staff',
        email: 'receptionist@hospital.com',
        role: 'Receptionist',
        password: await bcrypt.hash('recept123', 10),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const staff of staffUsers) {
      try {
        await prisma.staff.upsert({
          where: { email: staff.email },
          update: staff,
          create: staff,
        });
        console.log(`  ✅ ${staff.role}: ${staff.username}`);
      } catch (error) {
        console.error(`  ❌ Failed to create ${staff.role}:`, error.message);
      }
    }

    // ============================================================
    // 5. Create Role Permissions
    // ============================================================
    console.log('🔐 Creating role permissions...');

    const allModules = [
      'dashboard', 'patients', 'staff', 'appointments', 'prescriptions', 
      'labOrders', 'billing', 'pharmacy', 'pharmacyDashboard', 'pharmacyInventory',
      'nhisManagement', 'nhisAuthorizations', 'pharmacyStock', 'pharmacyTransactions',
      'pharmacyBranches', 'clinics', 'wards', 'pricing', 'billingOfficer', 'wallet',
      'patientIntake', 'admissions', 'patientHistory', 'roiRequests', 'nurseDashboard',
      'doctorDashboard', 'antenatal', 'archivedPatients', 'archivedPatientsView',
      'queueManagement', 'doctorQueue', 'hrDashboard', 'hrEmployees', 'hrDepartments',
      'hrLeaves', 'hrAttendance', 'hrPerformance', 'hrTrainings'
    ];

    const rolePermissions = {
      'Admin': Object.fromEntries(allModules.map(m => [m, true])),
      'ITAdmin': Object.fromEntries(allModules.map(m => [m, true])),
      'HR': {
        dashboard: true, patients: false, staff: true, appointments: false,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: true,
        archivedPatientsView: true, queueManagement: false, doctorQueue: false,
        hrDashboard: true, hrEmployees: true, hrDepartments: true,
        hrLeaves: true, hrAttendance: true, hrPerformance: true, hrTrainings: true
      },
      'Doctor': {
        dashboard: true, patients: true, staff: false, appointments: true,
        prescriptions: true, labOrders: true, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: true, antenatal: false, archivedPatients: false,
        archivedPatientsView: true, queueManagement: false, doctorQueue: true,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Nurse': {
        dashboard: true, patients: true, staff: false, appointments: false,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: true,
        doctorDashboard: false, antenatal: true, archivedPatients: false,
        archivedPatientsView: true, queueManagement: true, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Pharmacist': {
        dashboard: true, patients: false, staff: false, appointments: false,
        prescriptions: true, labOrders: false, billing: false, pharmacy: true,
        pharmacyDashboard: true, pharmacyInventory: true, nhisManagement: true,
        nhisAuthorizations: true, pharmacyStock: true, pharmacyTransactions: true,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: false, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'BillingOfficer': {
        dashboard: true, patients: true, staff: false, appointments: false,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: true, wallet: true, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: false, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Accountant': {
        dashboard: true, patients: false, staff: false, appointments: false,
        prescriptions: false, labOrders: false, billing: true, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: true,
        nhisAuthorizations: true, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: true,
        billingOfficer: false, wallet: true, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: false, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Records': {
        dashboard: true, patients: true, staff: false, appointments: false,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: true, admissions: true,
        patientHistory: true, roiRequests: true, nurseDashboard: false,
        doctorDashboard: false, antenatal: true, archivedPatients: true,
        archivedPatientsView: true, queueManagement: true, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'LabTechnician': {
        dashboard: true, patients: true, staff: false, appointments: false,
        prescriptions: false, labOrders: true, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: false, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'LabScientist': {
        dashboard: true, patients: true, staff: false, appointments: false,
        prescriptions: false, labOrders: true, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: true, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: true, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Radiologist': {
        dashboard: true, patients: true, staff: false, appointments: false,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: true, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Obstetrician': {
        dashboard: true, patients: true, staff: false, appointments: true,
        prescriptions: true, labOrders: true, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: true, antenatal: true, archivedPatients: false,
        archivedPatientsView: true, queueManagement: false, doctorQueue: true,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Midwife': {
        dashboard: true, patients: true, staff: false, appointments: false,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: true,
        doctorDashboard: false, antenatal: true, archivedPatients: false,
        archivedPatientsView: true, queueManagement: true, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'Receptionist': {
        dashboard: true, patients: true, staff: false, appointments: true,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: false, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
      'ITSupport': {
        dashboard: true, patients: false, staff: false, appointments: false,
        prescriptions: false, labOrders: false, billing: false, pharmacy: false,
        pharmacyDashboard: false, pharmacyInventory: false, nhisManagement: false,
        nhisAuthorizations: false, pharmacyStock: false, pharmacyTransactions: false,
        pharmacyBranches: false, clinics: false, wards: false, pricing: false,
        billingOfficer: false, wallet: false, patientIntake: false, admissions: false,
        patientHistory: false, roiRequests: false, nurseDashboard: false,
        doctorDashboard: false, antenatal: false, archivedPatients: false,
        archivedPatientsView: false, queueManagement: false, doctorQueue: false,
        hrDashboard: false, hrEmployees: false, hrDepartments: false,
        hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false
      },
    };

    for (const [role, permissions] of Object.entries(rolePermissions)) {
      try {
        await prisma.rolePermission.upsert({
          where: { role },
          update: { ...permissions, updatedAt: now },
          create: { role, ...permissions, createdAt: now, updatedAt: now },
        });
        console.log(`  ✅ ${role}`);
      } catch (error) {
        console.error(`  ❌ Failed to create permissions for ${role}:`, error.message);
      }
    }

    // ============================================================
    // 6. Create Test Patient
    // ============================================================
    console.log('👤 Creating test patient...');

    await prisma.patient.upsert({
      where: { hospitalId: '000001' },
      update: {
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
        updatedAt: now,
      },
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
        createdAt: now,
        updatedAt: now,
      },
    });
    console.log('  ✅ Test patient: John Oyelakin (000001)');

    // ============================================================
    // 7. Create Test Patient Wallet
    // ============================================================
    console.log('💳 Creating test patient wallet...');

    const testPatient = await prisma.patient.findUnique({
      where: { hospitalId: '000001' }
    });

    if (testPatient) {
      await prisma.patientWallet.upsert({
        where: { patientId: testPatient.id },
        update: {
          balance: 15000,
          status: 'Active',
          updatedAt: now,
        },
        create: {
          patientId: testPatient.id,
          balance: 15000,
          status: 'Active',
          currency: 'NGN',
          createdAt: now,
          updatedAt: now,
        },
      });
      console.log('  ✅ Test wallet: ₦15,000');
    }

    console.log('');
    console.log('🌱 Seeding complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('  👑 Admin:        admin@hospital.com / admin123');
    console.log('  🖥️ IT Admin:     itadmin@hospital.com / admin123');
    console.log('  👤 HR:           hr@hospital.com / hr123');
    console.log('  🩺 Doctor:       doctor@hospital.com / doctor123');
    console.log('  👩‍⚕️ Nurse:       nurse@hospital.com / nurse123');
    console.log('  💳 Billing:      billing@hospital.com / billing123');
    console.log('  💊 Pharmacist:   pharmacist@hospital.com / pharm123');
    console.log('  🔬 Lab Tech:     labtech@hospital.com / lab123');
    console.log('  🔬 Lab Scientist: labscientist@hospital.com / labsci123');
    console.log('  📷 Radiologist:  radiologist@hospital.com / rad123');
    console.log('  💰 Accountant:   accountant@hospital.com / acc123');
    console.log('  📋 Records:      records@hospital.com / records123');
    console.log('  🤰 Obstetrician: obstetrician@hospital.com / obg123');
    console.log('  👶 Midwife:      midwife@hospital.com / mid123');
    console.log('  📞 Receptionist: receptionist@hospital.com / recept123');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💰 SERVICE FEES:');
    console.log('  📝 Registration: ₦2,000');
    console.log('  🪪 ID Card:     ₦1,000');
    console.log('  🩺 Consultation: ₦5,000');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💳 TEST PATIENT: John Oyelakin (000001)');
    console.log('  💰 Wallet Balance: ₦15,000');
    console.log('  📋 Category: FPP');
    console.log('  📞 Phone: 08012345678');
    console.log('═══════════════════════════════════════════════════════════');

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