// fix-image.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    // ✅ Attach the existing image file to the order
    const updated = await prisma.imagingOrder.update({
      where: { orderNumber: 'IMG-2026-000001' },
      data: {
        images: 'http://localhost:3000/images/img-1787564733481-483300129.jpg',
        imageCount: 1,
        hasImages: true,
        status: 'Completed'  // keep it completed so it shows in View Report
      }
    });
    
    console.log('✅ Successfully attached image to order!');
    console.log('   Order Number:', updated.orderNumber);
    console.log('   images:      ', updated.images);
    console.log('   imageCount:  ', updated.imageCount);
    console.log('   hasImages:   ', updated.hasImages);
    console.log('   status:      ', updated.status);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();