// scripts/backfill-radiologist.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/prisma-client');

// 👇 PASTE THE ID FROM find-radiologist.js HERE
const RADIOLOGIST_ID = 'cmucld84s008lkslgzv6783be';

(async () => {
  try {
    if (RADIOLOGIST_ID === 'paste-the-id-here') {
      console.error('❌ You must set RADIOLOGIST_ID at the top of this file.');
      process.exit(1);
    }

    const result = await prisma.imagingOrder.updateMany({
      where: {
        status: 'Completed',
        radiologistId: null,
      },
      data: {
        radiologistId: RADIOLOGIST_ID,
      },
    });

    console.log(`✅ Backfilled ${result.count} completed order(s)`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();