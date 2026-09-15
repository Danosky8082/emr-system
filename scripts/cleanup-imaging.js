// scripts/cleanup-imaging.js
// One-off script to trigger imaging cleanup manually
// Usage:
//   node scripts/cleanup-imaging.js             → real run (deletes files)
//   node scripts/cleanup-imaging.js --dry-run   → preview only (safe)

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const uploadDir = path.join(__dirname, '..', 'uploads', 'imaging');
const GRACE_DAYS = parseInt(process.env.IMAGING_GRACE_DAYS || '7', 10);

async function cleanup() {
  console.log(DRY_RUN
    ? '🧪 Imaging cleanup (DRY RUN — no files will be deleted)'
    : '🧹 Imaging cleanup (LIVE — files will be deleted)');
  console.log(`   Directory: ${uploadDir}`);
  console.log(`   Grace:     ${GRACE_DAYS} days\n`);

  if (!fs.existsSync(uploadDir)) {
    console.log('⚠️  Upload directory does not exist. Nothing to clean.');
    return;
  }

  const files = fs.readdirSync(uploadDir);
  const cutoff = Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000;
  let scanned = 0;
  let orphaned = 0;
  let kept = 0;
  let skipped = 0;

  for (const file of files) {
    const filepath = path.join(uploadDir, file);

    let stats;
    try {
      stats = fs.statSync(filepath);
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;

    scanned++;

    // Skip files newer than grace period
    if (stats.mtimeMs > cutoff) {
      skipped++;
      continue;
    }

    // Check if any ImagingOrder references this file
    const referenced = await prisma.imagingOrder.findFirst({
      where: {
        OR: [
          { images: { contains: file } },
          { imagesUrl: { contains: file } },
        ],
      },
      select: { id: true },
    });

    if (referenced) {
      kept++;
      console.log(`   ✅ KEEP          ${file}`);
    } else {
      if (DRY_RUN) {
        orphaned++;
        console.log(`   🧪 WOULD DELETE  ${file}`);
      } else {
        try {
          fs.unlinkSync(filepath);
          orphaned++;
          console.log(`   🗑️  DELETE        ${file}`);
        } catch (err) {
          console.error(`   ⚠️  FAIL          ${file}: ${err.message}`);
        }
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Scanned: ${scanned}`);
  console.log(`   Kept:    ${kept}`);
  console.log(`   Deleted: ${orphaned}${DRY_RUN ? ' (would delete)' : ''}`);
  console.log(`   Skipped: ${skipped} (newer than ${GRACE_DAYS} days)`);
}

cleanup()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });