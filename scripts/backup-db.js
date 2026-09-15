// scripts/backup-db.js
// Automated PostgreSQL backup script.
// - Dumps the DB using pg_dump
// - Compresses with gzip
// - Rotates old backups (default: 30 days)

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const DATABASE_URL = process.env.DATABASE_URL;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
}

async function backupDatabase() {
  const startedAt = new Date();
  const timestamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `emr_backup_${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);
  const tempSql = path.join(BACKUP_DIR, `temp_${timestamp}.sql`);

  console.log(`🔄 [BACKUP] Starting: ${filename}`);

  try {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in .env');
    }

    // Parse the connection URL
    const url = new URL(DATABASE_URL);
    const host = url.hostname;
    const port = url.port || '5432';
    const user = url.username;
    const password = decodeURIComponent(url.password);
    const database = url.pathname.slice(1).split('?')[0];

    // Build pg_dump command — outputs plain SQL to a temp file
    const pgDumpCmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${tempSql}"`;

    // Run pg_dump with password in env
    await execAsync(pgDumpCmd, {
      env: { ...process.env, PGPASSWORD: password },
      maxBuffer: 500 * 1024 * 1024, // 500MB — plenty for large DBs
    });

    // Verify dump was created
    if (!fs.existsSync(tempSql)) {
      throw new Error('pg_dump did not produce an output file');
    }

    const rawSize = fs.statSync(tempSql).size;

    // Compress
    const sqlContent = fs.readFileSync(tempSql);
    const compressed = zlib.gzipSync(sqlContent, { level: 9 });
    fs.writeFileSync(filepath, compressed);

    // Clean up temp file
    fs.unlinkSync(tempSql);

    const compressedSize = fs.statSync(filepath).size;
    const sizeMB = (compressedSize / (1024 * 1024)).toFixed(2);
    const ratio = ((1 - compressedSize / rawSize) * 100).toFixed(1);
    const durationMs = Date.now() - startedAt.getTime();

    console.log(`✅ [BACKUP] Complete in ${durationMs}ms`);
    console.log(`   File:     ${filename}`);
    console.log(`   Size:     ${sizeMB} MB (compressed ${ratio}%)`);
    console.log(`   Location: ${filepath}`);

    // Rotate old backups
    await cleanupOldBackups();

    return { success: true, filename, sizeMB, durationMs };
  } catch (error) {
    console.error(`❌ [BACKUP] Failed: ${error.message}`);

    // Clean up partial files
    if (fs.existsSync(tempSql)) fs.unlinkSync(tempSql);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    throw error;
  }
}

async function cleanupOldBackups() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const files = fs.readdirSync(BACKUP_DIR).filter(
    (f) => f.startsWith('emr_backup_') && f.endsWith('.sql.gz')
  );

  let deleted = 0;
  for (const file of files) {
    const filepath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filepath);
    if (stats.mtime < cutoff) {
      fs.unlinkSync(filepath);
      deleted++;
      console.log(`🗑️  [BACKUP] Deleted old: ${file}`);
    }
  }

  if (deleted === 0) {
    console.log(`🗑️  [BACKUP] No old backups to delete (retention: ${RETENTION_DAYS} days)`);
  } else {
    console.log(`🗑️  [BACKUP] Deleted ${deleted} backup(s) older than ${RETENTION_DAYS} days`);
  }
}

// Allow running from command line: node scripts/backup-db.js
if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backupDatabase };