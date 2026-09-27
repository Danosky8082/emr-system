// src/storage.js
//
// Object storage abstraction for imaging uploads.
//
// Backends:
//   - 'cloudinary' → Cloudinary (production)
//   - 'local'      → local disk (dev fallback, no signup needed)
//
// The rest of the app talks only to `uploadFile`, `deleteFile`, `getFileStream`,
// and `getCdnUrl` and never needs to know which backend is active.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKEND = (process.env.STORAGE_BACKEND || 'local').toLowerCase();

// ============================================================
// LOCAL BACKEND (dev fallback)
// ============================================================
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'imaging');

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

const localBackend = {
  async uploadFile(buffer, key) {
    ensureLocalDir();
    const filepath = path.join(LOCAL_UPLOAD_DIR, key);
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, buffer);
    return { key, url: `/images/${key}`, size: buffer.length, backend: 'local' };
  },
  async deleteFile(key) {
    const filepath = path.join(LOCAL_UPLOAD_DIR, key);
    if (fs.existsSync(filepath)) { fs.unlinkSync(filepath); return true; }
    return false;
  },
  async getFileStream(key) {
    const filepath = path.join(LOCAL_UPLOAD_DIR, key);
    if (!fs.existsSync(filepath)) return null;
    return fs.createReadStream(filepath);
  },
};

// ============================================================
// CLOUDINARY BACKEND
// ============================================================
function createCloudinaryBackend() {
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'STORAGE_BACKEND=cloudinary but Cloudinary credentials are incomplete. ' +
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env'
    );
  }

  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
    timeout: 180000, // 3 minutes — do not remove
  });

  // --- DEBUG: confirm credentials loaded (redacted) ---
  console.log('🔧 Cloudinary config:', {
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: `${CLOUDINARY_API_KEY.slice(0, 4)}...${CLOUDINARY_API_KEY.slice(-4)}`,
    api_secret: `${CLOUDINARY_API_SECRET.slice(0, 4)}...${CLOUDINARY_API_SECRET.slice(-4)}`,
    sdk_version: require('cloudinary/package.json').version,
  });

  function toCloudinaryPublicId(key) {
    const withoutExt = key.replace(/\.[^.]+$/, '');
    return withoutExt.replace(/[^a-zA-Z0-9/_-]/g, '_');
  }

  return {
    async uploadFile(buffer, key) {
      const publicId = toCloudinaryPublicId(key);
      const startTime = Date.now();

      console.log(`📤 Cloudinary upload start: ${publicId} (${buffer?.length || 0} bytes)`);

      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: 'image',
            overwrite: false,
            invalidate: true,
            timeout: 180000, // 3 minutes
          },
          (error, result) => {
            const elapsed = Date.now() - startTime;
            if (error) {
              console.error(`❌ Cloudinary SDK error after ${elapsed}ms:`, JSON.stringify(error, null, 2));
              return reject(error);
            }
            console.log(`✅ Cloudinary upload complete in ${elapsed}ms: ${result.public_id}`);
            console.log(`   → URL: ${result.secure_url}`);
            resolve({
              key: result.public_id,
              url: result.secure_url,
              size: result.bytes || buffer.length,
              backend: 'cloudinary',
            });
          }
        );

        // Attach error handler in case the stream itself errors
        stream.on('error', (err) => {
          console.error('❌ Cloudinary upload stream error:', err);
          reject(err);
        });

        stream.end(buffer);
        console.log(`📤 Stream end() called with ${buffer?.length || 0} bytes`);
      });
    },

    async deleteFile(keyOrPublicId) {
      const publicId = keyOrPublicId.startsWith('imaging/')
        ? toCloudinaryPublicId(keyOrPublicId)
        : keyOrPublicId;
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
      return result.result === 'ok' || result.result === 'not found';
    },

    async getFileStream() {
      // Cloudinary serves from its CDN — no proxying needed.
      return null;
    },

    getCdnUrl(keyOrPublicId) {
  // If it's already a full Cloudinary URL, return it unchanged.
  if (typeof keyOrPublicId === 'string' &&
      keyOrPublicId.startsWith('http') &&
      keyOrPublicId.includes('cloudinary.com')) {
    return keyOrPublicId;
  }

  // Extract extension if present
  const extMatch = keyOrPublicId.match(/\.([a-zA-Z0-9]+)$/);
  const format = extMatch ? extMatch[1].toLowerCase() : undefined;

  const publicId = keyOrPublicId.startsWith('imaging/')
    ? toCloudinaryPublicId(keyOrPublicId)
    : keyOrPublicId;

  const opts = { secure: true, resource_type: 'image' };
  if (format) opts.format = format;

  return cloudinary.url(publicId, opts);
},
  };
}

// ============================================================
// PICK BACKEND
// ============================================================
let activeBackend;
if (BACKEND === 'cloudinary') {
  activeBackend = createCloudinaryBackend();
  console.log('✅ Object storage: Cloudinary');
} else {
  activeBackend = localBackend;
  console.log('⚠️  Object storage: LOCAL DISK (set STORAGE_BACKEND=cloudinary for production)');
}

// ============================================================
// PUBLIC API
// ============================================================
function generateKey(originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const now = new Date();
  const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = crypto.randomBytes(8).toString('hex');
  return `imaging/${yyyymm}/img-${rand}-${Date.now()}${ext}`;
}

async function uploadFile(buffer, originalName, mimeType) {
  const key = generateKey(originalName);
  return activeBackend.uploadFile(buffer, key, mimeType);
}

async function deleteFile(keyOrUrl) {
  const key = extractKey(keyOrUrl);
  if (!key) return false;
  return activeBackend.deleteFile(key);
}

async function getFileStream(keyOrUrl) {
  const key = extractKey(keyOrUrl);
  if (!key) return null;
  return activeBackend.getFileStream(key);
}

function getCdnUrl(keyOrUrl) {
  if (typeof activeBackend.getCdnUrl !== 'function') return null;
  const key = extractKey(keyOrUrl);
  if (!key) return null;
  return activeBackend.getCdnUrl(key);
}

function extractKey(keyOrUrl) {
  if (!keyOrUrl) return null;
  let s = String(keyOrUrl).trim();

  if (s.startsWith('/images/')) s = s.slice(8);

  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const url = new URL(s);

      // Cloudinary URL form: /<cloud>/image/upload/v<version>/imaging/...
      if (url.hostname.includes('cloudinary.com')) {
        const parts = url.pathname.split('/');
        const uploadIdx = parts.indexOf('upload');
        if (uploadIdx !== -1) {
          let rest = parts.slice(uploadIdx + 1);
          if (rest[0] && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
          const last = rest[rest.length - 1];
          if (last) rest[rest.length - 1] = last.replace(/\.[^.]+$/, '');
          return rest.join('/');
        }
      }

      s = url.pathname;
    } catch {
      return null;
    }
  }

  s = s.replace(/^\/+/, '');
  if (!s.startsWith('imaging/')) return null;
  return s;
}

module.exports = {
  uploadFile,
  deleteFile,
  getFileStream,
  getCdnUrl,
  generateKey,
  extractKey,
  backend: BACKEND,
};