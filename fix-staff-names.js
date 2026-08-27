// fix-staff-names.js
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

async function fixStaffNames() {
  try {
    console.log('🔍 Finding staff with missing names...');
    
    // Find staff with missing names
    const staff = await prisma.staff.findMany({
      where: {
        OR: [
          { firstName: null },
          { firstName: '' },
          { lastName: null },
          { lastName: '' }
        ]
      }
    });

    console.log(`📊 Found ${staff.length} staff with missing names`);

    if (staff.length === 0) {
      console.log('✅ All staff have proper names!');
      await prisma.$disconnect();
      return;
    }

    for (const s of staff) {
      const firstName = s.firstName || `Unknown${s.role ? ` ${s.role}` : ''}`;
      const lastName = s.lastName || 'Staff';
      
      await prisma.staff.update({
        where: { id: s.id },
        data: { 
          firstName: firstName,
          lastName: lastName 
        }
      });
      
      console.log(`✅ Updated ${s.id}: ${firstName} ${lastName} (${s.role})`);
    }

    console.log('✅ All staff names fixed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStaffNames();