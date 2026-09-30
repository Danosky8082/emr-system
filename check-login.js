// check-login.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  try {
    console.log('DB:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown');

    // 1. How many staff rows exist in total?
    const total = await prisma.staff.count();
    console.log('\n📊 Total staff rows:', total);

    if (total === 0) {
      console.log('\n❌ The database has NO staff rows.');
      console.log('   This DB was never seeded. Run:');
      console.log('     node prisma/seed.js');
      return;
    }

    // 2. Show every staff row's login-relevant fields
    const staff = await prisma.staff.findMany({
      select: {
        username: true,
        email: true,
        role: true,
        isActive: true,
        tenantId: true,
        password: true,
      },
      take: 30,
    });

    console.log('\n👥 Staff rows:');
    console.table(staff.map((s) => ({
      username: s.username,
      email: s.email,
      role: s.role,
      active: s.isActive,
      tenant: s.tenantId,
      hashStart: s.password?.slice(0, 10) + '…',
    })));

    // 3. Try the credentials you're typing
    const tryUsername = 'caretech-admin';
    const tryPassword = 'admin123';

    const match = staff.find((s) => s.username === tryUsername);
    if (!match) {
      console.log(`\n❌ No staff row with username "${tryUsername}".`);
      console.log('   Use one of these usernames instead:', staff.map((s) => s.username).join(', '));
    } else {
      const ok = await bcrypt.compare(tryPassword, match.password);
      console.log(`\n🔑 Testing "${tryUsername}" / "${tryPassword}":`,
        ok ? '✅ MATCH' : '❌ NO MATCH (password is different)');
      if (!match.isActive) console.log('   ⚠️  But isActive is FALSE — server will still reject.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();