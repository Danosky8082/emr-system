// fix-permissions.js - With proper database connection
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixPaediatricianPermissions() {
  try {
    console.log('🔍 Checking Paediatrician permissions...');
    
    // Check if Paediatrician role exists
    const existing = await prisma.rolePermission.findUnique({
      where: { role: 'Paediatrician' }
    });

    if (existing) {
      console.log('📝 Found existing Paediatrician permissions, updating...');
      
      // Update existing
      const result = await prisma.rolePermission.update({
        where: { role: 'Paediatrician' },
        data: {
          antenatal: true,
          laborAndDelivery: true,
          updatedAt: new Date()
        }
      });
      
      console.log('✅ Updated Paediatrician permissions:');
      console.log('   role:', result.role);
      console.log('   antenatal:', result.antenatal);
      console.log('   laborAndDelivery:', result.laborAndDelivery);
      
    } else {
      console.log('📝 No existing Paediatrician permissions, creating...');
      
      // Create new
      const result = await prisma.rolePermission.create({
        data: {
          role: 'Paediatrician',
          antenatal: true,
          laborAndDelivery: true,
          dashboard: true,
          patients: true,
          staff: false,
          appointments: true,
          prescriptions: true,
          labOrders: true,
          dental: false,
          optometry: false,
          nurseDashboard: false,
          doctorDashboard: false,
          doctorQueue: false,
          pharmacy: false,
          pharmacyDashboard: false,
          pharmacyInventory: false,
          nhisManagement: false,
          nhisAuthorizations: false,
          pharmacyStock: false,
          pharmacyTransactions: false,
          pharmacyBranches: false,
          billing: false,
          pricing: false,
          billingOfficer: false,
          wallet: false,
          patientIntake: false,
          admissions: false,
          patientHistory: false,
          roiRequests: false,
          archivedPatients: false,
          archivedPatientsView: true,
          clinics: false,
          wards: false,
          queueManagement: false,
          hrDashboard: false,
          hrEmployees: false,
          hrDepartments: false,
          hrLeaves: false,
          hrAttendance: false,
          hrPerformance: false,
          hrTrainings: false,
          radiology: false,
          patientPortal: false,
          portalSetup: false,
          immunizations: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log('✅ Created Paediatrician permissions:');
      console.log('   role:', result.role);
      console.log('   antenatal:', result.antenatal);
      console.log('   laborAndDelivery:', result.laborAndDelivery);
    }
    
    // Verify the change
    const verify = await prisma.rolePermission.findUnique({
      where: { role: 'Paediatrician' },
      select: {
        role: true,
        antenatal: true,
        laborAndDelivery: true,
        archivedPatientsView: true
      }
    });
    
    console.log('\n📋 Verification:');
    console.log('   Paediatrician permissions:', verify);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the function
fixPaediatricianPermissions();