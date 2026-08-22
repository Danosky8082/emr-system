// fix-permissions.js
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

async function fixPermissions() {
  try {
    console.log('🔧 Fixing permissions table...');
    
    // Add all missing columns
    await prisma.$executeRaw`
      ALTER TABLE "RolePermission" 
      ADD COLUMN IF NOT EXISTS "pharmacyDashboard" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pharmacyInventory" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "nhisManagement" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "nhisAuthorizations" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pharmacyStock" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pharmacyTransactions" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pharmacyBranches" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "archivedPatientsView" BOOLEAN DEFAULT false;
    `;
    console.log('✅ All columns added successfully!');
    
    // Update existing records to set default values
    await prisma.$executeRaw`
      UPDATE "RolePermission" 
      SET 
        "pharmacyDashboard" = COALESCE("pharmacyDashboard", false),
        "pharmacyInventory" = COALESCE("pharmacyInventory", false),
        "nhisManagement" = COALESCE("nhisManagement", false),
        "nhisAuthorizations" = COALESCE("nhisAuthorizations", false),
        "pharmacyStock" = COALESCE("pharmacyStock", false),
        "pharmacyTransactions" = COALESCE("pharmacyTransactions", false),
        "pharmacyBranches" = COALESCE("pharmacyBranches", false),
        "archivedPatientsView" = COALESCE("archivedPatientsView", false);
    `;
    console.log('✅ Updated existing records with default values');
    
    // Verify the columns exist
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'RolePermission' 
      AND column_name IN (
        'pharmacyDashboard', 'pharmacyInventory', 'nhisManagement', 
        'nhisAuthorizations', 'pharmacyStock', 'pharmacyTransactions', 
        'pharmacyBranches', 'archivedPatientsView'
      );
    `;
    console.log('✅ Columns verified:', result);
    
    console.log('✅ All permissions fixed!');
  } catch (error) {
    console.error('❌ Error fixing permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissions();