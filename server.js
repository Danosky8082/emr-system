// server.js - COMPLETE MULTI-TENANT EMR SYSTEM

// Silence dotenv's log output
process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const cron = require('node-cron');
const multer = require('multer');
 
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const storage = require('./src/storage');

// ✅ Multi-tenant Prisma client
const { prisma, getTenantPrisma } = require('./src/prisma-client');
const { backupDatabase } = require('./scripts/backup-db');
const { createDefaultHospitalData } = require('./src/hospital-templates');

// ============================================================
// JWT SECRET — hard-fail in production if missing
// ============================================================
//
// In development we fall back to a known string so the app boots
// without extra setup. In production we refuse to start — a
// missing secret means any user can forge tokens for any tenant.
//
const DEV_FALLBACK_SECRET = 'dev-only-secret-not-for-production-use-0000';

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('');
    console.error('❌ FATAL: JWT_SECRET is not set.');
    console.error('   Tokens cannot be signed or verified securely.');
    console.error('');
    console.error('   Set it in your host\'s environment variables:');
    console.error('     JWT_SECRET=<long-random-string>');
    console.error('');
    console.error('   Generate one with:');
    console.error('     node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    console.error('');
    process.exit(1);
  }

  // Dev only — noisy warning so it's obvious the secret is weak
  console.warn('');
  console.warn('⚠️  JWT_SECRET is not set. Using a development-only fallback.');
  console.warn('   DO NOT deploy this to production.');
  console.warn('');
  JWT_SECRET = DEV_FALLBACK_SECRET;
}

if (JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
  console.warn('');
  console.warn('⚠️  JWT_SECRET is the example value from the docs.');
  console.warn('   Change it before deploying.');
  console.warn('');
}

const SALT_ROUNDS = 10;
const DEFAULT_TENANT_ID = 'default-hospital-id';

const app = express();

// ============================================================
// 1. BODY PARSERS — MUST come before any route that reads req.body
// ============================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// ============================================================
// SHARED: Create default role permissions for a new hospital
// ============================================================
async function createDefaultRolePermissions(tx, hospitalId) {
  const allModules = [
    'dashboard','patients','staff','appointments','prescriptions','labOrders','billing',
    'pharmacy','pharmacyDashboard','pharmacyInventory','nhisManagement','nhisAuthorizations',
    'pharmacyStock','pharmacyTransactions','pharmacyBranches','clinics','wards','pricing',
    'billingOfficer','wallet','patientIntake','admissions','patientHistory','roiRequests',
    'nurseDashboard','doctorDashboard','antenatal','archivedPatients','archivedPatientsView',
    'queueManagement','doctorQueue','hrDashboard','hrEmployees','hrDepartments','hrLeaves',
    'hrAttendance','hrPerformance','hrTrainings','radiology','dental','optometry',
    'immunizations','patientPortal','portalSetup','laborAndDelivery',
  ];

  const base = Object.fromEntries(allModules.map((m) => [m, false]));
  const allTrue = Object.fromEntries(allModules.map((m) => [m, true]));

  const rolePerms = {
    Admin: allTrue,
    ITAdmin: allTrue,

    HR: { ...base,
      dashboard: true, staff: true,
      hrDashboard: true, hrEmployees: true, hrDepartments: true,
      hrLeaves: true, hrAttendance: true, hrPerformance: true, hrTrainings: true,
      archivedPatients: true, archivedPatientsView: true,
    },

    Doctor: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, labOrders: true,
      doctorDashboard: true, doctorQueue: true, patientHistory: true,
      archivedPatientsView: true, immunizations: true,
    },

    Obstetrician: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, labOrders: true,
      doctorDashboard: true, doctorQueue: true,
      antenatal: true, laborAndDelivery: true,
      archivedPatientsView: true, immunizations: true,
    },

    Nurse: { ...base,
      dashboard: true, patients: true,
      nurseDashboard: true, queueManagement: true,
      antenatal: true, laborAndDelivery: true,
      immunizations: true, archivedPatientsView: true,
    },

    Midwife: { ...base,
      dashboard: true, patients: true,
      nurseDashboard: true, queueManagement: true,
      antenatal: true, laborAndDelivery: true,
      archivedPatientsView: true, immunizations: true,
    },

    Pharmacist: { ...base,
      dashboard: true, prescriptions: true,
      pharmacy: true, pharmacyDashboard: true, pharmacyInventory: true,
      pharmacyStock: true, pharmacyTransactions: true,
      nhisManagement: true, nhisAuthorizations: true,
    },

    LabTechnician: { ...base,
      dashboard: true, patients: true, labOrders: true,
    },

    LabScientist: { ...base,
      dashboard: true, patients: true, labOrders: true,
      patientHistory: true, archivedPatientsView: true,
    },

    Radiologist: { ...base,
      dashboard: true, patients: true, radiology: true,
      archivedPatientsView: true,
    },

    Dentist: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, dental: true, archivedPatientsView: true,
    },

    Optometrist: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, optometry: true, archivedPatientsView: true,
    },

    Paediatrician: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, labOrders: true,
      immunizations: true, archivedPatientsView: true,
    },

    Surgeon: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, labOrders: true, archivedPatientsView: true,
    },

    Psychiatrist: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, labOrders: true, archivedPatientsView: true,
    },

    Accountant: { ...base,
      dashboard: true, billing: true, pricing: true, wallet: true,
      nhisManagement: true, nhisAuthorizations: true,
    },

    BillingOfficer: { ...base,
      dashboard: true, patients: true,
      billingOfficer: true, wallet: true,
    },

    Records: { ...base,
      dashboard: true, patients: true,
      patientIntake: true, admissions: true, patientHistory: true,
      roiRequests: true, queueManagement: true, antenatal: true,
      archivedPatients: true, archivedPatientsView: true,
      patientPortal: true, portalSetup: true,
    },

    Receptionist: { ...base,
      dashboard: true, patients: true, appointments: true,
    },
  };

  for (const [role, perms] of Object.entries(rolePerms)) {
    await tx.rolePermission.create({
      data: { tenantId: hospitalId, role, ...perms },
    });
  }

  return Object.keys(rolePerms).length;
}

// ============================================================
// 2. CORS — before routes
// ============================================================
//
// In production we allow only the deployed frontend origin(s).
// In development we also allow localhost on common Vite/React ports.
//
// To add more origins, set FRONTEND_URL as a comma-separated list:
//   FRONTEND_URL=https://app.example.com,https://staging.example.com
//
const ALLOWED_ORIGINS = (() => {
  const raw = process.env.FRONTEND_URL || '';
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Always allow localhost in dev (Vite default: 5173, CRA: 3000, alt: 5174)
  const devDefaults = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];

  return process.env.NODE_ENV === 'production' ? fromEnv : [...fromEnv, ...devDefaults];
})();

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (curl, Postman, SSR, health checks)
    // which send no Origin header at all.
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Also allow any hospital subdomain path on the same host, e.g.:
    //   https://yourapp.vercel.app/h/st-marys/login
    // will send Origin=https://yourapp.vercel.app — which is already in the list.
    // But if a hospital wants their own domain (e.g. emr.stmarys.health),
    // they must be added to FRONTEND_URL.

    // Log a short line instead of throwing — avoids a full stack trace
// for what is a normal "this origin isn't allowed" rejection.
console.warn(`🌐 CORS: rejected origin ${origin}`);
return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400,
}));

// ============================================================
// 3. SECURITY HEADERS — before routes
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Allow images from self, data URIs, blobs, and any HTTPS origin
      // (covers Cloudinary, S3, R2, and any CDN you add later)
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      // Allow fonts and styles from self + https
      fontSrc: ["'self'", 'https:', 'data:'],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      // Allow XHR/fetch to any https origin (for Cloudinary, APIs, etc.)
      connectSrc: ["'self'", 'https:', 'wss:'],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// ============================================================
// 4. HELPER FUNCTIONS
// ============================================================
async function findPatientIncludingDeleted(db, id, tenantId) {
  if (tenantId) {
    return prisma.patient.findFirst({ where: { id, tenantId } });
  }
  return db.patient.findFirst({ where: { id } });
}
async function generateUsername(slug, tenantId, tx = prisma) {
  const base = String(slug)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!base) throw new Error('Invalid slug for username generation');

  const MAX_ATTEMPTS = 50;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const candidate = `${base}-${suffix}`;

    const existing = await tx.staff.findFirst({
      where: { tenantId, username: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  throw new Error('Could not generate a unique username, please try again');
}


// ============================================================
// AUTHENTICATE MIDDLEWARE
// ============================================================
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    const tenantId = decoded.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Token missing tenant context. Please log in again.' });
    }
    req.tenantId = tenantId;
    req.db = getTenantPrisma(tenantId);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// ============================================================
// AUTHORIZE MIDDLEWARE
// ============================================================
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userRole = req.user.role?.toLowerCase() || '';
    const allowedRoles = roles.map(r => r.toLowerCase());
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        details: `Required roles: ${roles.join(', ')}`,
        userRole: req.user.role
      });
    }
    next();
  };
}

// ============================================================
// PATIENT AUTH MIDDLEWARE
// ============================================================
async function authenticatePatient(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'Patient') {
      return res.status(403).json({ error: 'Access denied. Patient portal only.' });
    }
    req.patient = decoded;

    const tenantId = decoded.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Token missing tenant context. Please log in again.' });
    }
    req.tenantId = tenantId;
    req.db = getTenantPrisma(tenantId);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Patient auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}



// ============================================================
// PERMISSION MIDDLEWARE (unchanged logic, just moved up)
// ============================================================
const checkPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (['Admin', 'ITAdmin'].includes(userRole)) {
        return next();
      }
      if (permissionKey === 'archivedPatients' || permissionKey === 'archivedPatientsView') {
        if (['Doctor', 'Obstetrician'].includes(userRole)) return next();
      }
      if (permissionKey === 'doctorQueue') {
        if (['Doctor', 'Obstetrician'].includes(userRole)) return next();
      }
      if (permissionKey === 'antenatal') {
        const allowedRoles = ['Obstetrician', 'Midwife', 'Nurse', 'Doctor', 'Records', 'Paediatrician'];
        if (allowedRoles.includes(userRole)) return next();
      }
      if (permissionKey === 'laborAndDelivery') {
        const allowedRoles = ['Obstetrician', 'Midwife', 'Nurse', 'Doctor', 'Paediatrician'];
        if (allowedRoles.includes(userRole)) return next();
      }
      if (permissionKey === 'dental') {
        if (['Dentist'].includes(userRole)) return next();
      }
      if (permissionKey === 'optometry') {
        if (['Optometrist'].includes(userRole)) return next();
      }
      if (permissionKey === 'radiology') {
        if (['Radiologist'].includes(userRole)) return next();
      }
      if (permissionKey === 'pharmacy' || permissionKey === 'pharmacyDashboard' ||
          permissionKey === 'pharmacyInventory' || permissionKey === 'pharmacyStock' ||
          permissionKey === 'pharmacyTransactions') {
        if (['Pharmacist'].includes(userRole)) return next();
      }
      if (permissionKey === 'labOrders') {
        if (['LabTechnician', 'LabScientist'].includes(userRole)) return next();
      }
      if (permissionKey === 'wallet') {
        if (['Accountant', 'BillingOfficer'].includes(userRole)) return next();
      }
      if (permissionKey === 'billing' || permissionKey === 'billingOfficer') {
        if (['Accountant', 'BillingOfficer'].includes(userRole)) return next();
      }
      if (permissionKey === 'pricing') {
        if (['Accountant'].includes(userRole)) return next();
      }
      if (permissionKey === 'staff') {
        if (['HR'].includes(userRole)) return next();
      }

      let rolePerm = await prisma.rolePermission.findFirst({
        where: { role: userRole, tenantId: req.tenantId }
      });

      if (!rolePerm) {
        try {
          rolePerm = await prisma.rolePermission.create({
            data: {
              tenantId: req.tenantId,
              role: userRole,
              dashboard: false, patients: false, staff: false,
              appointments: false, prescriptions: false, labOrders: false,
              antenatal: false, laborAndDelivery: false, dental: false,
              optometry: false, nurseDashboard: false, doctorDashboard: false,
              doctorQueue: false, pharmacy: false, pharmacyDashboard: false,
              pharmacyInventory: false, nhisManagement: false, nhisAuthorizations: false,
              pharmacyStock: false, pharmacyTransactions: false, pharmacyBranches: false,
              billing: false, pricing: false, billingOfficer: false, wallet: false,
              patientIntake: false, admissions: false, patientHistory: false,
              roiRequests: false, archivedPatients: false, archivedPatientsView: false,
              clinics: false, wards: false, queueManagement: false,
              hrDashboard: false, hrEmployees: false, hrDepartments: false,
              hrLeaves: false, hrAttendance: false, hrPerformance: false, hrTrainings: false,
              radiology: false, patientPortal: false, portalSetup: false, immunizations: false
            }
          });
        } catch (createError) {
          console.error(`❌ Failed to create permissions for ${userRole}:`, createError);
          return res.status(403).json({ error: 'Forbidden – insufficient permissions. Please contact administrator.' });
        }
      }

      if (rolePerm[permissionKey] !== true) {
        return res.status(403).json({ error: `Forbidden – you do not have permission to access ${permissionKey}` });
      }
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// ============================================================
// 5. ROUTES — after all middleware
// ============================================================

// ---------- 5c. Image proxy endpoint ----------
//
// Uses a regex path instead of the Express 5 wildcard syntax.
// Works identically in Express 4 and 5.
//
// For Cloudinary: 302 redirect to the CDN URL.
// For local disk: stream the file.
//
app.get(/^\/images\/(.+)$/, async (req, res) => {
  try {
    const key = req.params[0];

    if (!key || key.includes('..')) {
      return res.status(400).json({ error: 'Invalid image path' });
    }

    // Cloudinary → 302 redirect to CDN (saves server bandwidth)
    const cdnUrl = storage.getCdnUrl(key);
    if (cdnUrl) return res.redirect(302, cdnUrl);

    // Local disk → stream
    if (!key.startsWith('imaging/')) {
      return res.status(400).json({ error: 'Invalid image path' });
    }
    const stream = await storage.getFileStream(key);
    if (!stream) return res.status(404).json({ error: 'Image not found' });

    const ext = path.extname(key).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.dcm': 'application/dicom',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, max-age=31536000');
    stream.pipe(res);
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// ---------- 5d. Rate limiting (applies to ALL /api routes) ----------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000
});
app.use('/api', limiter);

// ---------- 5e. PLATFORM ROUTES — with diagnostics ----------
console.log('\n🔧 Loading platform routes...');

app.use('/api/platform', (req, res, next) => {
  console.log(`🌐 [PLATFORM] ${req.method} ${req.originalUrl} — hasAuth: ${!!req.headers.authorization}`);
  next();
});

try {
  const platformRouter = require('./src/routes/platform');

  if (typeof platformRouter !== 'function' && typeof platformRouter !== 'object') {
    throw new Error('platform.js did not export an Express router');
  }

  const routes = (platformRouter.stack || [])
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);

  console.log(`✅ Platform router loaded`);
  console.log(`   Routes registered: ${routes.length}`);
  console.log(`   Has /hospitals: ${routes.some(r => r.includes('/hospitals')) ? '✅ YES' : '❌ NO'}`);
  console.log(`   Route list: ${routes.join(', ') || '(none)'}`);

  app.use('/api/platform', platformRouter);
  console.log('✅ Platform routes mounted at /api/platform\n');
} catch (err) {
  console.error('❌ FAILED to load platform routes:', err.message);
  console.error('   Stack:', err.stack);

  app.use('/api/platform', (req, res) => {
    res.status(503).json({
      error: 'Platform routes failed to load',
      details: err.message,
      hint: 'See server console for full stack trace',
    });
  });
}

// ---------- 5f. Public hospital lookup by slug (no auth) ----------
app.get('/api/hospitals/slug/:slug', async (req, res) => {
  try {
    const hospital = await prisma.hospital.findUnique({
      where: { slug: req.params.slug },
      include: { Settings: true }
    });
    if (!hospital || !hospital.isActive) {
      return res.status(404).json({ error: 'Hospital not found or inactive' });
    }
    res.json({
      id: hospital.id,
      name: hospital.name,
      slug: hospital.slug,
      code: hospital.code,
      usernamePrefix: hospital.usernamePrefix,
      city: hospital.city,
      state: hospital.state,
      logoUrl: hospital.logoUrl,
      primaryColor: hospital.primaryColor,
      secondaryColor: hospital.secondaryColor,
      status: hospital.status,
      settings: hospital.Settings ? {
        currencySymbol: hospital.Settings.currencySymbol,
        timezone: hospital.Settings.timezone,
        enablePatientPortal: hospital.Settings.enablePatientPortal,
        enableKioskMode: hospital.Settings.enableKioskMode,
      } : null
    });
  } catch (error) {
    console.error('Get hospital by slug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- 5g. Auth-protected hospital lookup by id ----------
app.get('/api/hospitals/:id', authenticate, async (req, res) => {
  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: req.params.id },
      include: { Settings: true }
    });
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    if (req.user.tenantId !== hospital.id) {
      return res.status(403).json({ error: 'Access denied to this hospital' });
    }
    res.json(hospital);
  } catch (error) {
    console.error('Get hospital error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AUTHENTICATION ENDPOINTS
// ============================================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { employeeId, firstName, lastName, email, role, department, password, tenantId } = req.body;
    if (!employeeId || !firstName || !lastName || !email || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const resolvedTenantId = tenantId || DEFAULT_TENANT_ID;
    const existingStaff = await prisma.staff.findFirst({
      where: { email, tenantId: resolvedTenantId }
    });
    if (existingStaff) {
      return res.status(400).json({ error: 'Staff with this email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const staff = await prisma.staff.create({
      data: {
        tenantId: resolvedTenantId,
        employeeId, firstName, lastName, email, role, department,
        password: hashedPassword, isActive: true
      }
    });
    await prisma.auditLog.create({
      data: {
        tenantId: resolvedTenantId,
        staffId: staff.id,
        action: 'REGISTER',
        module: 'Auth',
        details: `Staff ${email} registered`
      }
    });
    const { password: _, ...staffWithoutPassword } = staff;
    res.status(201).json(staffWithoutPassword);
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body;

    const id = (identifier || email || username || '').trim();
    if (!id || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const idLower = id.toLowerCase();
    let staff = null;

    // ── Case 1: Email ────────────────────────────────
    if (idLower.includes('@')) {
      staff = await prisma.staff.findFirst({
        where: { email: idLower },
      });
    }
    // ── Case 2: Prefixed username ("caretech-admin") ──
    else if (idLower.includes('-')) {
      const firstHyphen = idLower.indexOf('-');
      const prefix = idLower.substring(0, firstHyphen);
      const localUsername = idLower.substring(firstHyphen + 1);

      const hospital = await prisma.hospital.findUnique({
        where: { usernamePrefix: prefix },
        select: { id: true, isActive: true, name: true },
      });

      if (!hospital) {
        return res.status(401).json({
          error: 'Invalid credentials. Check your hospital prefix.',
        });
      }
      if (!hospital.isActive) {
        return res.status(403).json({
          error: `Hospital "${hospital.name}" is not active. Contact support.`,
        });
      }

      staff = await prisma.staff.findFirst({
  where: {
    tenantId: hospital.id,
    OR: [
      { username: `${prefix}-${localUsername}` },  // "stmarys-admin"
      { username: localUsername },                 // "admin"
    ],
  },
});
    }
    // ── Case 3: Bare username ("admin") — legacy fallback ──
    else {
      const matches = await prisma.staff.findMany({
        where: { username: idLower },
      });
      if (matches.length === 0) {
        staff = null;
      } else if (matches.length === 1) {
        staff = matches[0];
      } else {
        return res.status(409).json({
          error: 'This username exists in multiple hospitals. Please include your hospital prefix (e.g., caretech-admin).',
          code: 'AMBIGUOUS_USERNAME',
        });
      }
    }

    if (!staff || !staff.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, staff.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: staff.id,
        email: staff.email,
        role: staff.role,
        username: staff.username,
        firstName: staff.firstName,
        lastName: staff.lastName,
        tenantId: staff.tenantId,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await prisma.auditLog.create({
      data: {
        tenantId: staff.tenantId,
        staffId: staff.id,
        action: 'LOGIN',
        module: 'Auth',
        details: `Staff ${staff.username || staff.email} logged in`,
        ipAddress: req.ip,
      },
    });

    const { password: _, ...staffWithoutPassword } = staff;
    res.json({ token, staff: staffWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Super Admin middleware
const requireSuperAdmin = (req, res, next) => {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// List all hospitals
app.get('/api/super-admin/hospitals', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { Staff: true, Patient: true }
        }
      }
    });
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CREATE A NEW HOSPITAL (Super Admin)
// ============================================================
app.post('/api/super-admin/hospitals', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, code, email, phone, address, city, state, plan } = req.body;

    if (!name || !slug || !code) {
      return res.status(400).json({ error: 'name, slug, code are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Create hospital
      const hospital = await tx.hospital.create({
        data: {
          name, slug, code, email, phone, address, city, state,
          plan: plan || 'trial',
          status: 'active',
          isActive: true,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      // 2) Default hospital settings
      await tx.hospitalSettings.create({
        data: { tenantId: hospital.id, hospitalId: hospital.id },
      });

            // 3) Default role permissions (20 roles)
      const rolesCreated = await createDefaultRolePermissions(tx, hospital.id);

      // 4) Default clinics, wards, departments, services
      const starterData = await createDefaultHospitalData(tx, hospital.id);

      return { hospital, rolesCreated, starterData };
    });

    res.status(201).json({
      ...result.hospital,
      _meta: {
        rolesCreated: result.rolesCreated,
        ...result.starterData, // clinics, wards, departments, services
      },
    });
  } catch (error) {
    console.error('Create hospital error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Slug or code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update hospital
app.patch('/api/super-admin/hospitals/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const hospital = await prisma.hospital.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(hospital);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suspend a hospital
app.patch('/api/super-admin/hospitals/:id/suspend', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const hospital = await prisma.hospital.update({
      where: { id: req.params.id },
      data: { status: 'suspended', isActive: false }
    });
    res.json(hospital);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reactivate a hospital
app.patch('/api/super-admin/hospitals/:id/reactivate', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const hospital = await prisma.hospital.update({
      where: { id: req.params.id },
      data: { status: 'active', isActive: true }
    });
    res.json(hospital);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Platform stats
app.get('/api/super-admin/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [totalHospitals, activeHospitals, totalStaff, totalPatients] = await Promise.all([
      prisma.hospital.count(),
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.staff.count(),
      prisma.patient.count(),
    ]);

    res.json({
      totalHospitals,
      activeHospitals,
      suspendedHospitals: totalHospitals - activeHospitals,
      totalStaff,
      totalPatients,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public — no auth required
app.post('/api/public/register-hospital', async (req, res) => {
  try {
    const {
      hospitalName, slug, code, usernamePrefix,
      adminEmail, adminFirstName, adminLastName, adminPassword,
    } = req.body;

    if (!hospitalName || !slug || !code || !usernamePrefix || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate prefix
    if (!/^[a-z0-9]+$/.test(usernamePrefix)) {
      return res.status(400).json({ error: 'Username prefix must be lowercase letters and numbers only' });
    }
    if (usernamePrefix.length < 2 || usernamePrefix.length > 20) {
      return res.status(400).json({ error: 'Username prefix must be 2-20 characters' });
    }

    // Check uniqueness — slug, code, AND prefix
    const conflict = await prisma.hospital.findFirst({
      where: {
        OR: [
          { slug },
          { code },
          { usernamePrefix },
        ],
      },
    });
    if (conflict) {
      if (conflict.slug === slug) return res.status(409).json({ error: 'Slug already taken' });
      if (conflict.code === code) return res.status(409).json({ error: 'Code already taken' });
      if (conflict.usernamePrefix === usernamePrefix) {
        return res.status(409).json({ error: 'Username prefix already taken. Try another.' });
      }
    }

    // Create hospital + admin + starter data in one transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1) Create hospital
      const hospital = await tx.hospital.create({
        data: {
          name: hospitalName,
          slug,
          code,
          usernamePrefix,
          email: adminEmail,
          plan: 'trial',
          status: 'active',
          isActive: true,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      // 2) Default hospital settings
      await tx.hospitalSettings.create({
        data: { tenantId: hospital.id, hospitalId: hospital.id },
      });

      // 3) Create the admin staff account
      const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
      const adminUsername = await generateUsername(slug, hospital.id, tx);

      const admin = await tx.staff.create({
        data: {
          tenantId: hospital.id,
          employeeId: 'ADMIN-001',
          username: adminUsername,
          firstName: adminFirstName,
          lastName: adminLastName,
          email: adminEmail,
          role: 'Admin',
          password: hashedPassword,
          isActive: true,
        },
      });

      // 4) Full 20-role permission matrix
      const rolesCreated = await createDefaultRolePermissions(tx, hospital.id);

      // 5) Default clinics, wards, departments, services
      const starterData = await createDefaultHospitalData(tx, hospital.id);

      return { hospital, admin, rolesCreated, starterData };
    });

    res.status(201).json({
      success: true,
      hospital: {
        id: result.hospital.id,
        name: result.hospital.name,
        slug: result.hospital.slug,
        usernamePrefix: result.hospital.usernamePrefix,
      },
      admin: {
        email: result.admin.email,
        role: result.admin.role,
        username: result.admin.username,
      },
      rolesCreated: result.rolesCreated,
      starterData: result.starterData,
    });
  } catch (error) {
    console.error('Hospital registration error:', error);
    res.status(500).json({ error: error.message });
  }
});



// ============================================================
// DEBUG ENDPOINT
// ============================================================
app.get('/api/debug/user', authenticate, async (req, res) => {
  try {
    const staff = await req.db.staff.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, firstName: true, lastName: true, role: true,
        email: true, username: true, isActive: true, departmentId: true
      }
    });
    res.json({
      tokenUser: req.user,
      dbStaff: staff,
      tokenRole: req.user?.role,
      dbRole: staff?.role,
      rolesMatch: req.user?.role === staff?.role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    const { tenantId } = req.query;
    let patientCount = null;
    if (tenantId) {
      patientCount = await prisma.patient.count({ where: { tenantId } });
    }
    res.json({ status: 'OK', message: 'Database connection successful!', patientCount });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// ============================================================
// PATIENT PORTAL HELPERS
// ============================================================
const generateTempToken = (patient, res) => {
  const token = jwt.sign(
    {
      id: patient.id,
      hospitalId: patient.hospitalId,
      role: 'Patient',
      mustChangePassword: true,
      tenantId: patient.tenantId
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  prisma.patient.updateMany({
    where: { id: patient.id, tenantId: patient.tenantId },
    data: { lastLogin: new Date() }
  }).catch(err => console.error('Failed to update last login:', err));

  res.json({
    token,
    mustChangePassword: true,
    message: 'Please change your temporary password',
    patient: {
      id: patient.id,
      hospitalId: patient.hospitalId,
      firstName: patient.firstName,
      lastName: patient.lastName
    }
  });
};

const generatePatientToken = (patient, res) => {
  const token = jwt.sign(
    {
      id: patient.id,
      hospitalId: patient.hospitalId,
      role: 'Patient',
      mustChangePassword: false,
      tenantId: patient.tenantId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  prisma.patient.updateMany({
    where: { id: patient.id, tenantId: patient.tenantId },
    data: { lastLogin: new Date() }
  }).catch(err => console.error('Failed to update last login:', err));

  res.json({
    token,
    mustChangePassword: false,
    patient: {
      id: patient.id,
      hospitalId: patient.hospitalId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone
    }
  });
};

// ============================================================
// PATIENT PORTAL ENDPOINTS
// ============================================================
app.post('/api/patient/login', async (req, res) => {
  try {
    const { hospitalId, password, pinCode, tenantId, hospitalSlug } = req.body;
    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }
    const where = { hospitalId };
    if (tenantId) {
      where.tenantId = tenantId;
    } else if (hospitalSlug) {
      const hospital = await prisma.hospital.findUnique({
        where: { slug: hospitalSlug },
        select: { id: true }
      });
      if (hospital) where.tenantId = hospital.id;
    }
    const patient = await prisma.patient.findFirst({ where });
    if (!patient) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!patient.portalAccess) {
      return res.status(403).json({ error: 'Portal access not enabled. Please contact the hospital.' });
    }
    if (pinCode && patient.pinCode) {
      const isValidPin = await bcrypt.compare(pinCode, patient.pinCode);
      if (isValidPin) {
        if (patient.mustChangePassword) return generateTempToken(patient, res);
        return generatePatientToken(patient, res);
      }
    }
    if (password && patient.password) {
      const isValidPassword = await bcrypt.compare(password, patient.password);
      if (isValidPassword) {
        if (patient.mustChangePassword) return generateTempToken(patient, res);
        return generatePatientToken(patient, res);
      }
    }
    return res.status(401).json({ error: 'Invalid PIN or Password' });
  } catch (error) {
    console.error('Patient login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/setup-portal', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { patientId, pinCode, password, forceChange } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });
    if (!pinCode && !password) return res.status(400).json({ error: 'PIN or Password is required' });

    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const shouldForceChange = forceChange !== undefined ? forceChange : true;
    const updateData = {
      portalAccess: true,
      mustChangePassword: shouldForceChange,
      pinAttempts: 0,
      lockedUntil: null
    };
    if (pinCode) {
      if (!/^\d{4,6}$/.test(pinCode)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
      updateData.pinCode = await bcrypt.hash(pinCode, SALT_ROUNDS);
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }
    const updatedPatient = await req.db.patient.update({
      where: { id: patientId },
      data: updateData
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'ENABLE_PATIENT_PORTAL',
        module: 'Patient Portal',
        details: `Enabled portal access for patient ${patient.hospitalId}${shouldForceChange ? ' (force change required)' : ''}`
      }
    });
    res.json({
      message: `Patient portal access enabled successfully${shouldForceChange ? ' (password change required on first login)' : ''}`,
      patient: {
        id: updatedPatient.id, hospitalId: updatedPatient.hospitalId,
        firstName: updatedPatient.firstName, lastName: updatedPatient.lastName,
        portalAccess: updatedPatient.portalAccess,
        mustChangePassword: updatedPatient.mustChangePassword
      }
    });
  } catch (error) {
    console.error('Setup portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/reset-portal', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const updatedPatient = await req.db.patient.update({
      where: { id: patientId },
      data: {
        pinCode: null, password: null, portalAccess: false,
        mustChangePassword: false, pinAttempts: 0, lockedUntil: null
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'RESET_PATIENT_PORTAL',
        module: 'Patient Portal',
        details: `Reset portal access for patient ${patient.hospitalId}`
      }
    });
    res.json({
      message: 'Patient portal access reset successfully',
      patient: {
        id: updatedPatient.id, hospitalId: updatedPatient.hospitalId,
        firstName: updatedPatient.firstName, lastName: updatedPatient.lastName,
        portalAccess: updatedPatient.portalAccess
      }
    });
  } catch (error) {
    console.error('Reset portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/forgot-password', async (req, res) => {
  try {
    const { hospitalId, email, tenantId, hospitalSlug } = req.body;
    if (!hospitalId && !email) {
      return res.status(400).json({ error: 'Hospital ID or email is required' });
    }
    const where = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (email) where.email = email;
    if (tenantId) {
      where.tenantId = tenantId;
    } else if (hospitalSlug) {
      const hospital = await prisma.hospital.findUnique({
        where: { slug: hospitalSlug },
        select: { id: true }
      });
      if (hospital) where.tenantId = hospital.id;
    }
    const patient = await prisma.patient.findFirst({ where });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const resetToken = jwt.sign(
      { id: patient.id, hospitalId: patient.hospitalId, tenantId: patient.tenantId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ message: 'Password reset instructions sent to your registered email', resetToken });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const patientId = decoded.id;
    const tenantId = decoded.tenantId;
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.patient.updateMany({
      where: { id: patientId, tenantId },
      data: { password: hashedPassword, mustChangePassword: false }
    });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/change-credentials', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { currentCredential, newCredential, confirmCredential, type } = req.body;
    if (!currentCredential || !newCredential || !confirmCredential) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (newCredential !== confirmCredential) {
      return res.status(400).json({ error: 'New credential does not match confirmation' });
    }
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    let isValid = false;
    if (type === 'pin' && patient.pinCode) {
      isValid = await bcrypt.compare(currentCredential, patient.pinCode);
    } else if (type === 'password' && patient.password) {
      isValid = await bcrypt.compare(currentCredential, patient.password);
    } else {
      return res.status(400).json({ error: 'Invalid credential type or no credential set' });
    }
    if (!isValid) return res.status(401).json({ error: 'Current credential is incorrect' });

    if (type === 'pin') {
      if (!/^\d{4,6}$/.test(newCredential)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    } else if (type === 'password') {
      if (newCredential.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hashedCredential = await bcrypt.hash(newCredential, SALT_ROUNDS);
    const updateData = { mustChangePassword: false, pinAttempts: 0 };
    if (type === 'pin') updateData.pinCode = hashedCredential;
    else updateData.password = hashedCredential;

    await req.db.patient.update({ where: { id: patientId }, data: updateData });
    const token = jwt.sign(
      {
        id: patient.id,
        hospitalId: patient.hospitalId,
        role: 'Patient',
        mustChangePassword: false,
        tenantId: patient.tenantId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      message: `${type === 'pin' ? 'PIN' : 'Password'} changed successfully!`,
      token,
      mustChangePassword: false
    });
  } catch (error) {
    console.error('Change credentials error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/must-change-password', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    res.json({ mustChangePassword: patient?.mustChangePassword || false });
  } catch (error) {
    console.error('Check must change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/force-change', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { patientId, forceChange } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const updatedPatient = await req.db.patient.update({
      where: { id: patientId },
      data: {
        mustChangePassword: forceChange !== undefined ? forceChange : true,
        lockedUntil: null,
        pinAttempts: 0
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'FORCE_PASSWORD_CHANGE',
        module: 'Patient Portal',
        details: `Forced password change for patient ${patient.hospitalId}`
      }
    });
    res.json({
      message: `Password change ${forceChange ? 'required' : 'no longer required'} for patient`,
      patient: {
        id: updatedPatient.id, hospitalId: updatedPatient.hospitalId,
        firstName: updatedPatient.firstName, lastName: updatedPatient.lastName,
        mustChangePassword: updatedPatient.mustChangePassword
      }
    });
  } catch (error) {
    console.error('Force change error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/dashboard', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const patient = await req.db.patient.findUnique({
      where: { id: patientId },
      select: { mustChangePassword: true }
    });
    if (patient?.mustChangePassword) {
      return res.status(403).json({
        error: 'You must change your password before accessing the dashboard',
        mustChangePassword: true
      });
    }

    const [appointments, prescriptions, labOrders, billingRecords, vitals, notifications] = await Promise.all([
      req.db.appointment.findMany({
        where: { patientId },
        include: { Staff: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { dateTime: 'asc' },
        take: 5
      }),
      req.db.prescription.findMany({
        where: { patientId },
        include: { Staff_Prescription_prescribingStaffIdToStaff: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      req.db.labOrder.findMany({
        where: { patientId },
        include: { Staff_LabOrder_orderingStaffIdToStaff: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      req.db.billingRecord.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      req.db.vitalSign.findMany({
        where: { patientId },
        include: { Staff: { select: { firstName: true, lastName: true } } },
        orderBy: { recordedAt: 'desc' },
        take: 5
      }),
      req.db.patient_notifications.findMany({
        where: { patientId, isRead: false },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const upcomingAppointments = appointments.filter(
      a => new Date(a.dateTime) > new Date() && a.status !== 'Cancelled'
    );
    const formattedAppointments = appointments.map(a => ({ ...a, staff: a.Staff }));
    const formattedPrescriptions = prescriptions.map(p => ({
      ...p,
      prescribedBy: p.Staff_Prescription_prescribingStaffIdToStaff
    }));
    const formattedLabOrders = labOrders.map(l => ({
      ...l,
      orderedBy: l.Staff_LabOrder_orderingStaffIdToStaff
    }));
    const formattedVitals = vitals.map(v => ({ ...v, nurse: v.Staff }));

    res.json({
      appointments: formattedAppointments,
      prescriptions: formattedPrescriptions,
      labOrders: formattedLabOrders,
      billingRecords,
      vitals: formattedVitals,
      notifications: notifications.length,
      stats: {
        totalAppointments: upcomingAppointments.length,
        totalPrescriptions: prescriptions.length,
        totalLabOrders: labOrders.length,
        totalBills: billingRecords.length
      }
    });
  } catch (error) {
    console.error('Patient dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/appointments', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { status } = req.query;
    const where = { patientId };
    if (status) where.status = status;
    const appointments = await req.db.appointment.findMany({
      where,
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { dateTime: 'asc' }
    });
    res.json(appointments.map(a => ({ ...a, staff: a.Staff })));
  } catch (error) {
    console.error('Get patient appointments error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/appointments', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { staffId, dateTime, duration, type, notes } = req.body;
    if (!staffId || !dateTime) {
      return res.status(400).json({ error: 'Staff and date/time are required' });
    }
    const staff = await req.db.staff.findFirst({ where: { id: staffId, isActive: true } });
    if (!staff) return res.status(404).json({ error: 'Doctor not available' });

    const conflicting = await req.db.appointment.findFirst({
      where: { staffId, dateTime: new Date(dateTime), status: { not: 'Cancelled' } }
    });
    if (conflicting) return res.status(400).json({ error: 'This time slot is already booked' });

    const appointment = await req.db.appointment.create({
      data: {
        patientId, staffId, dateTime: new Date(dateTime),
        duration: duration || 30, type: type || 'Consultation',
        notes: notes || 'Booked via Patient Portal', status: 'Scheduled'
      },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    res.status(201).json({ ...appointment, staff: appointment.Staff });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/patient/appointments/:id/cancel', authenticatePatient, async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.patient.id;
    const appointment = await req.db.appointment.findUnique({
      where: { id },
      include: { Patient: true }
    });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (appointment.patientId !== patientId) return res.status(403).json({ error: 'Not your appointment' });
    if (appointment.status === 'Cancelled') return res.status(400).json({ error: 'Appointment already cancelled' });
    if (new Date(appointment.dateTime) < new Date()) {
      return res.status(400).json({ error: 'Cannot cancel past appointments' });
    }
    const updated = await req.db.appointment.update({
      where: { id },
      data: { status: 'Cancelled' }
    });
    res.json({ message: 'Appointment cancelled successfully', appointment: updated });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/prescriptions', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const prescriptions = await req.db.prescription.findMany({
      where: { patientId },
      include: {
        Staff_Prescription_prescribingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
        Staff_Prescription_dispensingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(prescriptions.map(p => ({
      ...p,
      prescribedBy: p.Staff_Prescription_prescribingStaffIdToStaff,
      dispensedBy: p.Staff_Prescription_dispensingStaffIdToStaff
    })));
  } catch (error) {
    console.error('Get patient prescriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/lab-results', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const labOrders = await req.db.labOrder.findMany({
      where: { patientId },
      include: {
        Staff_LabOrder_orderingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
        Staff_LabOrder_labStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(labOrders.map(l => ({
      ...l,
      orderedBy: l.Staff_LabOrder_orderingStaffIdToStaff,
      performedBy: l.Staff_LabOrder_labStaffIdToStaff
    })));
  } catch (error) {
    console.error('Get patient lab results error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/billing', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const bills = await req.db.billingRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bills);
  } catch (error) {
    console.error('Get patient billing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PATIENT PORTAL — WALLET
// The staff routes at /api/patients/:id/wallet require a staff token.
// These patient-portal variants use authenticatePatient instead, so the
// logged-in patient can see their own wallet + transactions.
// ============================================================
app.get('/api/patient/wallet', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    let wallet = await req.db.patientWallet.findUnique({
      where: { patientId }
    });

    // Auto-create a wallet if it doesn't exist yet (so the UI never 404s)
    if (!wallet) {
      wallet = await req.db.patientWallet.create({
        data: {
          patientId,
          balance: 0,
          currency: 'NGN',
          status: 'Active',
          updatedAt: new Date()
        }
      });
    }

    res.json({
      id: wallet.id,
      balance: wallet.balance,
      currency: wallet.currency,
      status: wallet.status,
      lastTransactionAt: wallet.lastTransactionAt,
      patientId: wallet.patientId
    });
  } catch (error) {
    console.error('Patient wallet fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/wallet/transactions', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const wallet = await req.db.patientWallet.findUnique({
      where: { patientId },
      select: { id: true }
    });

    if (!wallet) {
      return res.json({
        transactions: [],
        total: 0,
        limit,
        offset,
        hasMore: false
      });
    }

    const [transactions, total] = await Promise.all([
      req.db.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      req.db.walletTransaction.count({ where: { walletId: wallet.id } })
    ]);

    res.json({
      transactions,
      total,
      limit,
      offset,
      hasMore: total > offset + limit
    });
  } catch (error) {
    console.error('Patient wallet transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/medical-history', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const history = await req.db.patientHistoryRecord.findMany({
      where: { patientId },
      orderBy: { encounterDate: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error('Get patient medical history error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/vitals', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const vitals = await req.db.vitalSign.findMany({
      where: { patientId },
      include: { Staff: { select: { firstName: true, lastName: true } } },
      orderBy: { recordedAt: 'desc' }
    });
    res.json(vitals.map(v => ({ ...v, nurse: v.Staff })));
  } catch (error) {
    console.error('Get patient vitals error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/notifications', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { unreadOnly = 'false' } = req.query;
    const where = { patientId };
    if (unreadOnly === 'true') where.isRead = false;
    const notifications = await req.db.patient_notifications.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    const unreadCount = await req.db.patient_notifications.count({
      where: { patientId, isRead: false }
    });
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/patient/notifications/:id/read', authenticatePatient, async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.patient.id;
    const notification = await req.db.patient_notifications.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.patientId !== patientId) return res.status(403).json({ error: 'Not your notification' });
    const updated = await req.db.patient_notifications.update({
      where: { id },
      data: { isRead: true }
    });
    res.json({ message: 'Notification marked as read', notification: updated });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/patient/notifications/read-all', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    await req.db.patient_notifications.updateMany({
      where: { patientId, isRead: false },
      data: { isRead: true }
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patient/profile', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { phone, email, address, emergencyContact } = req.body;
    const patient = await req.db.patient.update({
      where: { id: patientId },
      data: {
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        emergencyContact: emergencyContact || undefined
      },
      select: {
        id: true, hospitalId: true, firstName: true, lastName: true,
        phone: true, email: true, address: true, emergencyContact: true
      }
    });
    res.json({ message: 'Profile updated successfully', patient });
  } catch (error) {
    console.error('Update patient profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/change-password', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient || !patient.password) {
      return res.status(400).json({ error: 'Portal account not set up properly' });
    }
    const isValid = await bcrypt.compare(currentPassword, patient.password);
    if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await req.db.patient.update({
      where: { id: patientId },
      data: { password: hashedPassword, mustChangePassword: false, lastPasswordChange: new Date() }
    });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/available-doctors', authenticatePatient, async (req, res) => {
  try {
    const { clinicId } = req.query;
    const where = { isActive: true, role: { in: ['Doctor', 'Obstetrician'] } };
    const doctors = await req.db.staff.findMany({
      where,
      include: { StaffClinic: { include: { Clinic: true } }, department: true },
      orderBy: { firstName: 'asc' }
    });
    res.json(doctors);
  } catch (error) {
    console.error('Get available doctors error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PATIENT ENDPOINTS
// ============================================================
app.post('/api/patients', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const {
      firstName, lastName, dateOfBirth, gender, phone, email, address,
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone,
      nextOfKinRelationship, patientCategory, insuranceProvider,
      insuranceId, corporateCompany
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !gender) {
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, dateOfBirth, gender' });
    }
    if (!nextOfKinPhone) {
      return res.status(400).json({ error: 'Next of Kin phone number is required' });
    }

    const allPatients = await req.db.patient.findMany({ select: { hospitalId: true } });
    let maxNumericId = 0;
    for (const p of allPatients) {
      const num = parseInt(p.hospitalId, 10);
      if (!isNaN(num) && num > maxNumericId) maxNumericId = num;
    }

    let nextIdNumber = maxNumericId + 1;
    let patient;
    let attempts = 0;
    while (attempts < 5) {
      try {
        const hospitalId = ((nextIdNumber * 9301 + 12345) % 1000000).toString().padStart(6, '0');
        patient = await req.db.patient.create({
          data: {
            hospitalId, firstName, lastName, dateOfBirth: new Date(dateOfBirth), gender,
            phone: phone || null, email: email || null, address: address || null,
            emergencyContact: emergencyContact || null, allergies: allergies || null,
            nextOfKinName: nextOfKinName || null, nextOfKinPhone: nextOfKinPhone || null,
            nextOfKinRelationship: nextOfKinRelationship || null,
            patientCategory: patientCategory || 'FPP',
            insuranceProvider: insuranceProvider || null,
            insuranceId: insuranceId || null,
            corporateCompany: corporateCompany || null,
            updatedAt: new Date()
          }
        });
        break;
      } catch (err) {
        if (err.code === 'P2002') { attempts++; nextIdNumber++; } else { throw err; }
      }
    }
    if (!patient) throw new Error('Failed to generate a unique Hospital ID after multiple attempts.');

    const category = patient.patientCategory || 'FPP';
    let multiplier = 1;
    let categoryLabel = 'FPP';
    if (category === 'NHIS') { multiplier = 0.1; categoryLabel = 'NHIS (10%)'; }
    else if (category === 'RETAINER') { multiplier = 2; categoryLabel = 'Retainer (200%)'; }

    const regFee = 2000, cardFee = 1000, consultFee = 5000;
    const registrationAmount = Math.round(regFee * multiplier);
    const cardAmount = Math.round(cardFee * multiplier);
    const consultationAmount = Math.round(consultFee * multiplier);
    const totalAmount = registrationAmount + cardAmount + consultationAmount;

    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${timestamp}-${random}`;

    const billingItems = [
      { name: 'Registration Fee', category: 'Registration', amount: registrationAmount, status: 'Pending', serviceType: 'REGISTRATION' },
      { name: 'Hospital ID Card', category: 'Administrative', amount: cardAmount, status: 'Pending', serviceType: 'CARD' },
      { name: 'Consultation Fee', category: 'Consultation', amount: consultationAmount, status: 'Pending', serviceType: 'CONSULTATION' }
    ];

    const billingRecord = await req.db.billingRecord.create({
      data: {
        patientId: patient.id, invoiceNumber,
        items: billingItems, totalAmount, paidAmount: 0,
        balance: totalAmount, status: 'Pending',
        description: `Registration, Card & Consultation (${categoryLabel}) - Total: ₦${totalAmount.toLocaleString()}`,
        updatedAt: new Date()
      }
    });

    const journey = await req.db.patientJourney.create({
      data: {
        patientId: patient.id, destinationType: 'CLINIC', registeredById: req.user.id,
        status: 'REGISTERED', billingRecordId: billingRecord.id,
        registrationFeeBilled: true, cardFeeBilled: true, consultationFeeBilled: true,
        updatedAt: new Date()
      }
    });

    await req.db.billingRecord.update({
      where: { id: billingRecord.id },
      data: {
        description: `${billingRecord.description} | Journey: ${journey.id}`,
        updatedAt: new Date()
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_PATIENT',
        module: 'Patient',
        details: `Created patient ${firstName} ${lastName} (${patient.hospitalId}) with auto-billing`
      }
    });

    res.status(201).json({ ...patient, billingRecord, journey });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/patients', authenticate, authorize(
  'Admin', 'Records', 'ITAdmin', 'BillingOfficer',
  'Doctor', 'Nurse', 'Obstetrician', 'Midwife',
  'Radiologist', 'LabTechnician', 'LabScientist',
  'Dentist', 'Optometrist', 'Paediatrician',
  'Surgeon', 'Psychiatrist', 'Ophthalmologist',
  'Dermatologist', 'Cardiologist', 'Neurologist',
  'Orthopedic', 'ENT', 'Urologist',
  'Anaesthesiologist', 'Pathologist'
), async (req, res) => {
  try {
    const patients = await req.db.patient.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(patients);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ARCHIVE ENDPOINTS
// ============================================================
app.get('/api/patients/archived', authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Doctor', 'Obstetrician'];
    const viewOnlyRoles = ['Doctor', 'Obstetrician'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied. Only Admin, Records, and Doctors can view archived patients.' });
    }
    const isViewOnly = viewOnlyRoles.includes(userRole);

    const patients = await req.db.patient.findMany({
      where: { isArchived: true },
      orderBy: { archivedAt: 'desc' }
    });

    const formattedPatients = patients.map(p => {
      const { password, ...patientWithoutPassword } = p;
      return { ...patientWithoutPassword, isViewOnly, journeys: [] };
    });

    if (isViewOnly && patients.length > 0) {
      const patientIds = patients.map(p => p.id);
      const journeys = await req.db.patientJourney.findMany({
        where: { patientId: { in: patientIds }, status: 'COMPLETED' },
        select: {
          patientId: true, status: true, completedAt: true,
          clinicId: true, wardId: true
        },
        orderBy: { createdAt: 'desc' }
      });
      const journeyMap = {};
      journeys.forEach(j => {
        if (!journeyMap[j.patientId]) journeyMap[j.patientId] = [];
        const exists = journeyMap[j.patientId].some(e =>
          e.status === j.status && e.completedAt === j.completedAt
        );
        if (!exists) journeyMap[j.patientId].push(j);
      });
      formattedPatients.forEach(p => {
        p.journeys = journeyMap[p.id] || [];
      });
    }
    res.json(formattedPatients);
  } catch (error) {
    console.error('❌ Get archived patients error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/api/patients/archived-view', authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const patients = await req.db.patient.findMany({
      where: { isArchived: true },
      orderBy: { archivedAt: 'desc' }
    });

    const formattedPatients = patients.map(p => {
      const { password, ...patientWithoutPassword } = p;
      return { ...patientWithoutPassword, journeys: [] };
    });

    if (patients.length > 0) {
      const patientIds = patients.map(p => p.id);
      const journeys = await req.db.patientJourney.findMany({
        where: { patientId: { in: patientIds }, status: 'COMPLETED' },
        select: {
          patientId: true, status: true, completedAt: true,
          clinicId: true, wardId: true
        },
        orderBy: { createdAt: 'desc' }
      });
      const journeyMap = {};
      journeys.forEach(j => {
        if (!journeyMap[j.patientId]) journeyMap[j.patientId] = [];
        journeyMap[j.patientId].push(j);
      });
      formattedPatients.forEach(p => {
        p.journeys = (journeyMap[p.id] || []).slice(0, 1);
      });
    }
    res.json(formattedPatients);
  } catch (error) {
    console.error('❌ Get archived patients view error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/patients/:id/unarchive', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await findPatientIncludingDeleted(req.db, id, req.tenantId);
    if (!patient || !patient.deletedAt) {
      return res.status(404).json({ error: 'Patient not found or not deleted' });
    }
    if (!patient.isArchived) {
      return res.status(400).json({ error: 'Patient is not archived' });
    }

    const unarchivedPatient = await req.db.patient.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedReason: null,
        archivedBy: null,
        autoArchived: false,
        fileStatus: 'ACTIVE',
        updatedAt: new Date()
      }
    });

    const journey = await req.db.patientJourney.findFirst({
      where: { patientId: id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' }
    });
    if (journey) {
      await req.db.patientJourney.update({
        where: { id: journey.id },
        data: { archivedAt: null, updatedAt: new Date() }
      });
    }

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UNARCHIVE_PATIENT',
        module: 'Records',
        details: `Unarchived patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}`
      }
    });

    const { password, ...patientWithoutPassword } = unarchivedPatient;
    res.json({ message: 'Patient unarchived successfully', patient: patientWithoutPassword });
  } catch (error) {
    console.error('❌ Unarchive error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/patients/:id/request-reactivation', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userRole = req.user?.role;
    if (!['Doctor', 'Obstetrician'].includes(userRole)) {
      return res.status(403).json({ error: 'Only Doctors can request reactivation.' });
    }
    const patient = await req.db.patient.findFirst({
      where: {
        id,
        isArchived: true,
        OR: [
          { deletedAt: null },
          { deletedAt: { not: null } }
        ]
      }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    await req.db.patient.update({
      where: { id },
      data: { activationRequestedAt: new Date(), updatedAt: new Date() }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'REQUEST_REACTIVATION',
        module: 'Records',
        details: `Doctor ${req.user.firstName} ${req.user.lastName} requested reactivation for ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}. Reason: ${reason || 'Not specified'}`
      }
    });

    res.json({ message: 'Reactivation request sent to Records department.' });
  } catch (error) {
    console.error('❌ Request reactivation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients/:id/activate', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, destinationType, clinicId, wardId } = req.body;

    const patient = await findPatientIncludingDeleted(req.db, id, req.tenantId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!patient.isArchived) return res.status(400).json({ error: 'Patient is not archived' });

    const updatedPatient = await req.db.patient.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedReason: null,
        archivedBy: null,
        autoArchived: false,
        fileStatus: 'ACTIVE',
        activationRequestedAt: null,
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      }
    });

    if (destinationType === 'CLINIC' && clinicId) {
      const journey = await req.db.patientJourney.create({
        data: {
          patientId: patient.id,
          destinationType: 'CLINIC',
          clinicId,
          registeredById: req.user.id,
          status: 'SENT_TO_DESTINATION',
          sentToDestinationAt: new Date(),
          updatedAt: new Date()
        }
      });
      await req.db.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'REACTIVATE_FILE',
          module: 'Records',
          details: `Reactivated file for ${patient.hospitalId} and sent to clinic. Reason: ${reason || 'Manual'}`
        }
      });
      const { password, ...patientWithoutPassword } = updatedPatient;
      return res.json({
        message: 'File reactivated and sent to clinic successfully',
        patient: patientWithoutPassword,
        journey
      });
    }

    if (destinationType === 'WARD' && wardId) {
      const journey = await req.db.patientJourney.create({
        data: {
          patientId: patient.id,
          destinationType: 'WARD',
          wardId,
          registeredById: req.user.id,
          status: 'SENT_TO_DESTINATION',
          sentToDestinationAt: new Date(),
          updatedAt: new Date()
        }
      });
      const admissionCount = await req.db.admission.count();
      await req.db.admission.create({
        data: {
          admissionNumber: `ADM-${new Date().getFullYear()}-${String(admissionCount + 1).padStart(4, '0')}`,
          patientId: patient.id,
          wardId,
          staffId: req.user.id,
          status: 'Admitted',
          notes: `Admitted via file reactivation. Reason: ${reason || 'Manual'}`,
          updatedAt: new Date()
        }
      });
      await req.db.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'REACTIVATE_FILE',
          module: 'Records',
          details: `Reactivated file for ${patient.hospitalId} and admitted to ward. Reason: ${reason || 'Manual'}`
        }
      });
      const { password, ...patientWithoutPassword } = updatedPatient;
      return res.json({
        message: 'File reactivated and patient admitted successfully',
        patient: patientWithoutPassword,
        journey
      });
    }

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'REACTIVATE_FILE',
        module: 'Records',
        details: `Reactivated file for ${patient.hospitalId}. Reason: ${reason || 'Manual'}`
      }
    });
    const { password, ...patientWithoutPassword } = updatedPatient;
    res.json({ message: 'File reactivated successfully', patient: patientWithoutPassword });
  } catch (error) {
    console.error('❌ Activate error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// GET PATIENT BY ID (full file)
// ============================================================
app.get('/api/patients/:id', authenticate, async (req, res) => {
  try {
    const patientId = req.params.id;
    const patient = await req.db.patient.findFirst({
      where: {
        id: patientId,
        OR: [{ deletedAt: null }, { deletedAt: { not: null } }]
      },
      include: {
        Appointment: { include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        ClinicalNote: { include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        Prescription: {
          include: {
            Staff_Prescription_prescribingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
            Staff_Prescription_dispensingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
          }
        },
        LabOrder: {
          include: {
            Staff_LabOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
            Staff_LabOrder_labStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
          }
        },
        BillingRecord: true,
        Admission: true,
        PatientJourney: true,
        PatientWallet: true,
        PaymentPlan: true,
        Pregnancy: true,
        VitalSign: true,
        dental_records: true,
        immunizations: true,
        optometry_records: true,
        patient_notifications: true,
        PatientHistoryRecord: true,
        PatientMessage: true,
        PatientQueue: true,
        PatientTransfer: true,
        NHISAuthorization: true,
        NHISClaim: true,
        KioskSession: true,
        ImagingOrder: true
      }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (['Nurse', 'Doctor'].includes(req.user.role)) {
      const activeJourney = await req.db.patientJourney.findFirst({
        where: { patientId, status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] } },
        select: { clinicId: true, wardId: true }
      });
      if (!activeJourney) {
        return res.status(403).json({ error: 'This patient has not yet arrived at a clinic or ward.' });
      }
      const staff = await req.db.staff.findUnique({
        where: { id: req.user.id },
        include: {
          StaffClinic: { select: { clinicId: true } },
          StaffWard: { select: { wardId: true } }
        }
      });
      const allowedClinicIds = staff?.StaffClinic?.map(c => c.clinicId) || [];
      const allowedWardIds = staff?.StaffWard?.map(w => w.wardId) || [];
      const isAuthorized =
        (activeJourney.clinicId && allowedClinicIds.includes(activeJourney.clinicId)) ||
        (activeJourney.wardId && allowedWardIds.includes(activeJourney.wardId));
      if (!isAuthorized) {
        return res.status(403).json({
          error: 'You are not assigned to the clinic or ward where this patient is located.'
        });
      }
    }

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'VIEW_PATIENT',
        module: 'Patient',
        details: `Viewed patient ${patient.hospitalId}`
      }
    });
    res.json(patient);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PATIENT IMAGING ORDERS (used by PatientProfile.jsx)
// ============================================================
app.get('/api/patients/:patientId/imaging-orders',
  authenticate,
  authorize(
    'Admin', 'ITAdmin',
    'Doctor', 'Obstetrician', 'Paediatrician', 'Surgeon', 'Psychiatrist',
    'Nurse', 'Midwife', 'Radiologist'
  ),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const imagingOrders = await req.db.imagingOrder.findMany({
        where: { patientId },
        include: {
          Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true } },
          Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
          Staff_ImagingOrder_radiologistIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
          ImagingResult: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedOrders = imagingOrders.map(order => {
        const rawImages = order.images || order.imagesUrl || '';
        const imageArray = rawImages ? rawImages.split(',').filter(u => u && u.trim() !== '') : [];
        return {
          ...order,
          patient: order.Patient,
          orderingStaff: order.Staff_ImagingOrder_orderingStaffIdToStaff,
          radiologist: order.Staff_ImagingOrder_radiologistIdToStaff,
          imagingResults: order.ImagingResult,
          images: rawImages,
          imageArray,
          imageCount: imageArray.length,
          hasImages: imageArray.length > 0,
          status: order.status || 'Ordered'
        };
      });

      res.json(formattedOrders);
    } catch (error) {
      console.error('❌ Get patient imaging orders error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// MARK PATIENT AS ACCESSED
// ============================================================
app.post('/api/patients/:id/mark-accessed', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await req.db.patient.update({
      where: { id },
      data: { lastAccessedAt: new Date(), updatedAt: new Date() }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Mark accessed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PATIENT SEARCH
// ============================================================
app.get('/api/patients/search/:query', authenticate, async (req, res) => {
  try {
    const { query } = req.params;
    const patients = await req.db.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { hospitalId: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(patients);
  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patients/:id', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, dateOfBirth, gender, phone, email, address,
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone,
      nextOfKinRelationship, patientCategory, insuranceProvider,
      insuranceId, corporateCompany
    } = req.body;
    const patient = await req.db.patient.update({
      where: { id },
      data: {
        firstName, lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender, phone, email, address, emergencyContact, allergies,
        nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
        patientCategory: patientCategory || 'FPP',
        insuranceProvider: insuranceProvider || null,
        insuranceId: insuranceId || null,
        corporateCompany: corporateCompany || null
      }
    });
    res.json(patient);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// SOFT-DELETE PATIENT
// ============================================================
app.delete('/api/patients/:id', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!id || id.length < 5) {
      return res.status(400).json({ error: 'Invalid patient ID format.' });
    }
    const existingPatient = await req.db.patient.findUnique({ where: { id } });
    if (!existingPatient) return res.status(404).json({ error: 'Patient not found.' });
    if (existingPatient.deletedAt) {
      return res.status(400).json({
        error: 'Patient is already deleted.',
        deletedAt: existingPatient.deletedAt,
        code: 'ALREADY_DELETED'
      });
    }

    const deletedPatient = await req.db.patient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: req.user.id,
        deleteReason: reason || 'Manual deletion via UI',
        isArchived: true,
        archivedAt: new Date(),
        archivedReason: `Deleted: ${reason || 'Manual deletion'}`,
        fileStatus: 'DELETED',
        updatedAt: new Date()
      }
    });

    await req.db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        staffId: req.user.id,
        action: 'SOFT_DELETE_PATIENT',
        module: 'Patient',
        details: `Soft-deleted patient ${existingPatient.hospitalId} (${existingPatient.firstName} ${existingPatient.lastName}). Reason: ${reason || 'Not specified'}`
      }
    });

    res.json({
      success: true,
      message: 'Patient archived (soft-deleted). Data retained for legal compliance.',
      patient: {
        id: deletedPatient.id,
        hospitalId: deletedPatient.hospitalId,
        firstName: deletedPatient.firstName,
        lastName: deletedPatient.lastName,
        deletedAt: deletedPatient.deletedAt,
        deletedBy: deletedPatient.deletedBy,
        deleteReason: deletedPatient.deleteReason,
        fileStatus: deletedPatient.fileStatus
      },
      recoverable: true,
      restoreEndpoint: `POST /api/patients/${id}/restore`
    });
  } catch (error) {
    console.error('Soft-delete patient error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete patient.' });
  }
});

// ============================================================
// RESTORE A SOFT-DELETED PATIENT
// ============================================================
app.post('/api/patients/:id/restore', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const patient = await findPatientIncludingDeleted(req.db, id, req.tenantId);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    if (!patient.deletedAt) {
      return res.status(400).json({
        error: 'Patient is not deleted — nothing to restore.',
        code: 'NOT_DELETED'
      });
    }

    const restored = await req.db.patient.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        isArchived: false,
        archivedAt: null,
        archivedReason: null,
        fileStatus: 'ACTIVE',
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      }
    });

    await req.db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        staffId: req.user.id,
        action: 'RESTORE_PATIENT',
        module: 'Patient',
        details: `Restored patient ${patient.hospitalId} (${patient.firstName} ${patient.lastName}). Reason: ${reason || 'Manual restore'}`
      }
    });

    res.json({
      success: true,
      message: 'Patient restored successfully',
      patient: {
        id: restored.id,
        hospitalId: restored.hospitalId,
        firstName: restored.firstName,
        lastName: restored.lastName,
        fileStatus: restored.fileStatus,
        isArchived: restored.isArchived
      }
    });
  } catch (error) {
    console.error('Restore patient error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET SOFT-DELETED PATIENTS
// ============================================================
app.get('/api/patients/deleted/list', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    const where = { deletedAt: { not: null } };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { hospitalId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [patients, total] = await Promise.all([
      req.db.patient.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true, hospitalId: true, firstName: true, lastName: true,
          gender: true, phone: true, email: true,
          deletedAt: true, deletedBy: true, deleteReason: true,
          archivedAt: true, fileStatus: true
        }
      }),
      req.db.patient.count({ where })
    ]);

    res.json({
      data: patients,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('List deleted patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PATIENT HISTORY ENDPOINTS
// ============================================================
app.get('/api/patients/:patientId/history', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const historyRecords = await req.db.patientHistoryRecord.findMany({
      where: { patientId },
      orderBy: { encounterDate: 'desc' }
    });
    res.json(historyRecords);
  } catch (error) {
    console.error('Get patient history error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/history', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    if (!search) return res.json([]);
    const patients = await req.db.patient.findMany({
      where: {
        OR: [
          { hospitalId: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      },
      select: { id: true, hospitalId: true, firstName: true, lastName: true, gender: true, dateOfBirth: true }
    });
    if (patients.length === 0) return res.json([]);
    const patientIds = patients.map(p => p.id);
    const historyRecords = await req.db.patientHistoryRecord.findMany({
      where: { patientId: { in: patientIds } },
      include: {
        Patient: { select: { hospitalId: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } }
      },
      orderBy: { encounterDate: 'desc' }
    });
    res.json(historyRecords.map(h => ({ ...h, patient: h.Patient })));
  } catch (error) {
    console.error('Patient history search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients/history', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { patientId, doctorName, encounterType, diagnosis, icd10Code, notes } = req.body;
    if (!patientId || !doctorName || !diagnosis) {
      return res.status(400).json({ error: 'Missing required fields: patientId, doctorName, diagnosis' });
    }
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const record = await req.db.patientHistoryRecord.create({
      data: {
        patientId, doctorName,
        encounterType: encounterType || 'Outpatient',
        diagnosis, icd10Code, notes
      },
      include: { Patient: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'ADD_MEDICAL_CODING',
        module: 'Records',
        details: `Added history/coding for patient ${record.Patient.hospitalId} (ICD-10: ${icd10Code || 'N/A'})`
      }
    });
    res.status(201).json(record);
  } catch (error) {
    console.error('Create history error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// ROI REQUESTS
// ============================================================
app.get('/api/roi', authenticate, async (req, res) => {
  try {
    const requests = await req.db.rOIRequest.findMany({ orderBy: { requestDate: 'desc' } });
    res.json(requests);
  } catch (error) {
    console.error('Get ROI error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/roi', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { requestorName, patientName, requestType } = req.body;
    if (!requestorName || !patientName || !requestType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const roi = await req.db.rOIRequest.create({
      data: { requestorName, patientName, requestType }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_ROI_REQUEST',
        module: 'Records',
        details: `Created ROI request for ${patientName} by ${requestorName}`
      }
    });
    res.status(201).json(roi);
  } catch (error) {
    console.error('Create ROI error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/roi/:id', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const roi = await req.db.rOIRequest.update({ where: { id }, data: { status } });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_ROI_STATUS',
        module: 'Records',
        details: `Updated ROI request ${id} to ${status}`
      }
    });
    res.json(roi);
  } catch (error) {
    console.error('Update ROI error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// STAFF MANAGEMENT
// ============================================================
app.get('/api/staff', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const staff = await req.db.staff.findMany({
      include: { department: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      staff.map(({ password, department, ...rest }) => ({
        ...rest,
        department: department?.name || null,
        departmentId: department?.id || null,
      }))
    );
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await req.db.staff.findUnique({
      where: { id },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    const { password, department, ...rest } = staff;
    res.json({
      ...rest,
      department: department?.name || null,
      departmentId: department?.id || null,
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { employeeId, firstName, lastName, email, role, department, password } = req.body;

    if (!employeeId || !firstName || !lastName || !email || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: req.tenantId },
      select: { usernamePrefix: true, name: true },
    });
    if (!hospital?.usernamePrefix) {
      return res.status(500).json({ error: 'Hospital username prefix not configured' });
    }

    const existingEmployeeId = await req.db.staff.findFirst({ where: { employeeId } });
    if (existingEmployeeId) return res.status(400).json({ error: 'Employee ID already exists' });

    const existingEmail = await req.db.staff.findFirst({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: 'Staff with this email already exists' });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const staff = await prisma.$transaction(async (tx) => {
      // 1) Generate slug-based username: stmarys-4821
      const username = await generateUsername(hospital.usernamePrefix, req.tenantId, tx);

      // 2) Resolve department name → Department row id (auto-create if missing)
      let departmentId = null;
      if (department && department.trim()) {
        const name = department.trim();
        let dept = await tx.department.findFirst({
          where: { tenantId: req.tenantId, name },
          select: { id: true },
        });
        if (!dept) {
          dept = await tx.department.create({
            data: { tenantId: req.tenantId, name, isActive: true },
            select: { id: true },
          });
        }
        departmentId = dept.id;
      }

      // 3) Create staff
      return tx.staff.create({
        data: {
          tenantId: req.tenantId,
          employeeId,
          username,
          firstName,
          lastName,
          email,
          role,
          departmentId,
          password: hashedPassword,
          isActive: true,
          updatedAt: new Date(),
        },
        include: {
          department: { select: { id: true, name: true } },
        },
      });
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_STAFF',
        module: 'Staff',
        details: `Created staff ${staff.username} as ${role}`,
      },
    });

    const { password: _, department: deptRel, ...rest } = staff;
    res.status(201).json({
      ...rest,
      department: deptRel?.name || null,
      departmentId: deptRel?.id || null,
    });
  } catch (error) {
    console.error('Create staff error:', error);
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return res.status(400).json({ error: `Duplicate value for ${field}.` });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, firstName, lastName, username, email, role, department, isActive } = req.body;

    const staff = await prisma.$transaction(async (tx) => {
      // Resolve department only if the key was sent
      let departmentId;
      if (department !== undefined) {
        if (department === null || department === '') {
          departmentId = null;
        } else {
          const name = department.trim();
          let dept = await tx.department.findFirst({
            where: { tenantId: req.tenantId, name },
            select: { id: true },
          });
          if (!dept) {
            dept = await tx.department.create({
              data: { tenantId: req.tenantId, name, isActive: true },
              select: { id: true },
            });
          }
          departmentId = dept.id;
        }
      }

      return tx.staff.update({
        where: { id },
        data: {
          employeeId,
          firstName,
          lastName,
          username: username ? username.toLowerCase().trim() : undefined,
          email,
          role,
          departmentId,
          isActive,
          updatedAt: new Date(),
        },
        include: {
          department: { select: { id: true, name: true } },
        },
      });
    });

    const { password, department: deptRel, ...rest } = staff;
    res.json({
      ...rest,
      department: deptRel?.name || null,
      departmentId: deptRel?.id || null,
    });
  } catch (error) {
    console.error('Update staff error:', error);
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return res.status(400).json({ error: `Duplicate value for ${field}.` });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const existingStaff = await req.db.staff.findUnique({ where: { id } });
    if (!existingStaff) return res.status(404).json({ error: 'Staff not found' });
    const staff = await req.db.staff.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DEACTIVATE_STAFF',
        module: 'Staff',
        details: `Deactivated staff ${staff.email}`
      }
    });
    const { password, ...staffWithoutPassword } = staff;
    res.json(staffWithoutPassword);
  } catch (error) {
    console.error('Deactivate staff error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/staff/:id/reactivate', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const existingStaff = await req.db.staff.findUnique({ where: { id } });
    if (!existingStaff) return res.status(404).json({ error: 'Staff not found' });
    const staff = await req.db.staff.update({
      where: { id },
      data: { isActive: true, updatedAt: new Date() }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'REACTIVATE_STAFF',
        module: 'Staff',
        details: `Reactivated staff ${staff.email}`
      }
    });
    const { password, ...staffWithoutPassword } = staff;
    res.json(staffWithoutPassword);
  } catch (error) {
    console.error('Reactivate staff error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/staff/:id/reset-password', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existingStaff = await req.db.staff.findUnique({ where: { id } });
    if (!existingStaff) return res.status(404).json({ error: 'Staff not found' });
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const staff = await req.db.staff.update({
      where: { id },
      data: { password: hashedPassword, updatedAt: new Date() }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'RESET_PASSWORD',
        module: 'Staff',
        details: `Reset password for staff ${staff.email}`
      }
    });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// STAFF ASSIGNMENTS
// ============================================================
app.get('/api/staff/:staffId/assignments', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { staffId } = req.params;
    const staff = await req.db.staff.findUnique({
      where: { id: staffId },
      include: {
        StaffClinic: { include: { Clinic: true } },
        StaffWard: { include: { Ward: true } }
      }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const clinicIds = staff.StaffClinic?.map(sc => sc.clinicId).filter(Boolean) || [];
    const wardIds = staff.StaffWard?.map(sw => sw.wardId).filter(Boolean) || [];
    const clinics = staff.StaffClinic?.map(sc => sc.Clinic).filter(Boolean) || [];
    const wards = staff.StaffWard?.map(sw => sw.Ward).filter(Boolean) || [];
    res.json({ clinicIds, wardIds, clinics, wards });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Fixed - let the extension handle tenantId
app.post('/api/staff/:staffId/clinics', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { staffId } = req.params;
    const { clinicId } = req.body;
    const existing = await req.db.staffClinic.findFirst({
      where: { staffId, clinicId }  // ✅ No tenantId - extension adds it
    });
    if (existing) return res.status(400).json({ error: 'Staff already assigned to this clinic' });
    await req.db.staffClinic.create({ data: { staffId, clinicId } });  // ✅ Extension adds tenantId
    res.json({ message: 'Clinic assigned successfully' });
  } catch (error) {
    console.error('Assign clinic error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff/:staffId/clinics/:clinicId', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { staffId, clinicId } = req.params;
    await req.db.staffClinic.deleteMany({
      where: { staffId, clinicId }  // ✅ No tenantId - extension adds it
    });
    res.json({ message: 'Clinic unassigned successfully' });
  } catch (error) {
    console.error('Unassign clinic error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff/:staffId/wards', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { staffId } = req.params;
    const { wardId } = req.body;
    const existing = await req.db.staffWard.findFirst({
      where: { staffId, wardId }  // ✅ No tenantId - extension adds it
    });
    if (existing) return res.status(400).json({ error: 'Staff already assigned to this ward' });
    await req.db.staffWard.create({ data: { staffId, wardId } });  // ✅ Extension adds tenantId
    res.json({ message: 'Ward assigned successfully' });
  } catch (error) {
    console.error('Assign ward error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff/:staffId/wards/:wardId', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { staffId, wardId } = req.params;
    await req.db.staffWard.deleteMany({
      where: { staffId, wardId }  // ✅ No tenantId - extension adds it
    });
    res.json({ message: 'Ward unassigned successfully' });
  } catch (error) {
    console.error('Unassign ward error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// APPOINTMENTS
// ============================================================
app.get('/api/appointments', authenticate, async (req, res) => {
  try {
    const { patientId, staffId, status, dateFrom, dateTo } = req.query;
    let where = {};
    if (patientId) where.patientId = patientId;
    if (staffId) where.staffId = staffId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.dateTime = {};
      if (dateFrom) where.dateTime.gte = new Date(dateFrom);
      if (dateTo) where.dateTime.lte = new Date(dateTo);
    }
    const appointments = await req.db.appointment.findMany({
      where,
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true } },
        Staff: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { dateTime: 'asc' }
    });
    res.json(appointments.map(a => ({ ...a, patient: a.Patient, staff: a.Staff })));
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/appointments', authenticate, async (req, res) => {
  try {
    const { patientId, staffId, dateTime, duration, type, notes } = req.body;
    if (!patientId || !staffId || !dateTime) {
      return res.status(400).json({ error: 'Missing required fields: patientId, staffId, dateTime' });
    }
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const staff = await req.db.staff.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    const conflicting = await req.db.appointment.findFirst({
      where: { staffId, dateTime: new Date(dateTime), status: { not: 'Cancelled' } }
    });
    if (conflicting) return res.status(400).json({ error: 'This time slot is already booked' });

    const appointment = await req.db.appointment.create({
      data: {
        patientId, staffId, dateTime: new Date(dateTime),
        duration: duration || 30, type: type || 'Consultation',
        notes: notes || null, status: 'Scheduled', updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true } },
        Staff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_APPOINTMENT',
        module: 'Appointment',
        details: `Created appointment for patient ${patient.hospitalId} with ${staff.firstName} ${staff.lastName}`
      }
    });
    res.status(201).json({ ...appointment, patient: appointment.Patient, staff: appointment.Staff });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/appointments/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const appointment = await req.db.appointment.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_APPOINTMENT',
        module: 'Appointment',
        details: `Updated appointment ${id} status to ${status}`
      }
    });
    res.json(appointment);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// DOCTOR PATIENTS
// ============================================================
app.get('/api/doctor/patients', authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role || '';
    const isAdmin = ['Admin', 'ITAdmin'].includes(userRole);
    const isDoctor = ['Doctor', 'Obstetrician', 'Paediatrician'].includes(userRole);
    if (!isAdmin && !isDoctor) {
      return res.status(403).json({
        error: 'Access denied. Only Doctors, Obstetricians, Paediatricians, and Admins can view this page.',
        userRole
      });
    }

    const staff = await req.db.staff.findUnique({
      where: { id: req.user.id },
      include: {
        StaffClinic: { select: { clinicId: true } },
        StaffWard: { select: { wardId: true } }
      }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const clinicIds = staff.StaffClinic?.map(c => c.clinicId) || [];
    const wardIds = staff.StaffWard?.map(w => w.wardId) || [];

    let whereClause = {};
    if (isAdmin && clinicIds.length === 0 && wardIds.length === 0) {
      whereClause = { status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] } };
    } else {
      if (clinicIds.length === 0 && wardIds.length === 0) return res.json([]);
      whereClause = {
        status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
        OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
      };
    }

    const journeys = await req.db.patientJourney.findMany({
      where: whereClause,
      include: {
        Patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true,
            gender: true, dateOfBirth: true, phone: true, email: true,
            address: true, emergencyContact: true, allergies: true,
            nextOfKinName: true, nextOfKinPhone: true, nextOfKinRelationship: true,
            patientCategory: true
          }
        },
        Clinic: true,
        Ward: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(journeys.map(j => ({ ...j, patient: j.Patient, clinic: j.Clinic, ward: j.Ward })));
  } catch (error) {
    console.error('❌ Error fetching doctor patients:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// NURSE PATIENTS
// ============================================================
app.get('/api/nurse/patients', authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role || '';
    const isAdmin = ['Admin', 'ITAdmin'].includes(userRole);
    const isNurse = ['Nurse', 'Midwife'].includes(userRole);
    const isDoctor = ['Doctor', 'Obstetrician', 'Paediatrician'].includes(userRole);
    if (!isAdmin && !isNurse && !isDoctor) {
      return res.status(403).json({
        error: 'Access denied. Only Nurses, Midwives, Doctors, Paediatricians, and Admins can view this page.',
        userRole
      });
    }

    const staff = await req.db.staff.findUnique({
      where: { id: req.user.id },
      include: {
        StaffClinic: { select: { clinicId: true } },
        StaffWard: { select: { wardId: true } }
      }
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const clinicIds = staff.StaffClinic?.map(c => c.clinicId) || [];
    const wardIds = staff.StaffWard?.map(w => w.wardId) || [];

    let whereClause = {};
    if (isAdmin && clinicIds.length === 0 && wardIds.length === 0) {
      whereClause = { status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] } };
    } else {
      if (clinicIds.length === 0 && wardIds.length === 0) return res.json([]);
      whereClause = {
        status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
        OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
      };
    }

    const journeys = await req.db.patientJourney.findMany({
      where: whereClause,
      include: {
        Patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true,
            gender: true, dateOfBirth: true, phone: true, email: true,
            address: true, emergencyContact: true, allergies: true,
            nextOfKinName: true, nextOfKinPhone: true, nextOfKinRelationship: true,
            patientCategory: true
          }
        },
        Clinic: true,
        Ward: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(journeys.map(j => ({ ...j, patient: j.Patient, clinic: j.Clinic, ward: j.Ward })));
  } catch (error) {
    console.error('❌ Error fetching nurse patients:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PAEDIATRIC
// ============================================================
app.get('/api/paediatric/patients', authenticate, authorize('Paediatrician', 'Admin', 'Doctor', 'Nurse'), async (req, res) => {
  try {
    const staffId = req.user.id;
    const userRole = req.user.role;
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    let whereClause = { dateOfBirth: { gte: eighteenYearsAgo } };
    if (userRole === 'Paediatrician') {
      whereClause.Appointment = { some: { staffId } };
    }
    const childPatients = await req.db.patient.findMany({
      where: whereClause,
      select: {
        id: true, hospitalId: true, firstName: true, lastName: true,
        gender: true, dateOfBirth: true, phone: true, email: true,
        address: true, emergencyContact: true, allergies: true,
        nextOfKinName: true, nextOfKinPhone: true, nextOfKinRelationship: true,
        patientCategory: true,
        Appointment: {
          where: userRole === 'Paediatrician' ? { staffId } : {},
          orderBy: { dateTime: 'desc' },
          take: 3,
          select: {
            id: true, dateTime: true, status: true, type: true,
            Staff: { select: { firstName: true, lastName: true, role: true } }
          }
        },
        immunizations: {
          orderBy: { administrationDate: 'desc' },
          take: 2,
          select: { id: true, vaccineName: true, doseNumber: true, administrationDate: true, nextDueDate: true }
        },
        Prescription: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          select: { id: true, medication: true, dosage: true, status: true, createdAt: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    const formattedPatients = childPatients.map(p => ({
      ...p,
      lastAppointment: p.Appointment?.[0] || null,
      recentImmunizations: p.immunizations || [],
      recentPrescriptions: p.Prescription || []
    }));
    res.json(formattedPatients);
  } catch (error) {
    console.error('Get paediatric patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/paediatric/vitals/:patientId', authenticate, authorize('Paediatrician', 'Admin', 'Doctor', 'Nurse'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await req.db.patient.findUnique({ where: { id: patientId }, select: { dateOfBirth: true } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const vitals = await req.db.vitalSign.findMany({
      where: { patientId },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { recordedAt: 'desc' }
    });
    res.json(vitals);
  } catch (error) {
    console.error('Get paediatric vitals error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/paediatric/growth/:patientId', authenticate, authorize('Paediatrician', 'Admin', 'Doctor', 'Nurse'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const growthData = await req.db.vitalSign.findMany({
      where: { patientId, OR: [{ weight: { not: null } }, { height: { not: null } }] },
      orderBy: { recordedAt: 'asc' },
      select: { recordedAt: true, weight: true, height: true, notes: true }
    });
    const formattedGrowthData = growthData.map(record => {
      let bmi = null;
      if (record.weight && record.height) {
        const heightInMeters = record.height / 100;
        bmi = parseFloat((record.weight / (heightInMeters * heightInMeters)).toFixed(1));
      }
      return { date: record.recordedAt, weight: record.weight, height: record.height, bmi, notes: record.notes };
    });
    res.json(formattedGrowthData);
  } catch (error) {
    console.error('Get growth data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PAEDIATRIC — Immunization schedule alias
// PaediatricDashboard.jsx calls /api/paediatric/immunizations/:id
// but the canonical route is /api/immunizations/patient/:id.
// This alias lets the frontend stay as-is.
// ============================================================
app.get('/api/paediatric/immunizations/:patientId',
  authenticate,
  authorize('Paediatrician', 'Admin', 'Doctor', 'Nurse', 'ITAdmin'),
  async (req, res) => {
    try {
      const { patientId } = req.params;

      const patient = await req.db.patient.findUnique({
        where: { id: patientId },
        select: { id: true, dateOfBirth: true }
      });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      // Pull every immunization already recorded for this patient
      const given = await req.db.immunizations.findMany({
        where: { patientId },
        orderBy: { administrationDate: 'asc' }
      });

      // Compute the WHO/EPI Nigeria paediatric schedule based on age
      // and mark each item as given/pending.
      const dob = new Date(patient.dateOfBirth);
      const ageInDays = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24));

      const EPI_SCHEDULE = [
        { vaccine: 'BCG',                    dueAge: 'At birth',       dueDays: 0   },
        { vaccine: 'Hepatitis B (birth dose)', dueAge: 'At birth',     dueDays: 0   },
        { vaccine: 'OPV 0',                  dueAge: 'At birth',       dueDays: 0   },
        { vaccine: 'OPV 1',                  dueAge: '6 weeks',        dueDays: 42  },
        { vaccine: 'Pentavalent 1',          dueAge: '6 weeks',        dueDays: 42  },
        { vaccine: 'PCV 1',                  dueAge: '6 weeks',        dueDays: 42  },
        { vaccine: 'Rotavirus 1',            dueAge: '6 weeks',        dueDays: 42  },
        { vaccine: 'OPV 2',                  dueAge: '10 weeks',       dueDays: 70  },
        { vaccine: 'Pentavalent 2',          dueAge: '10 weeks',       dueDays: 70  },
        { vaccine: 'PCV 2',                  dueAge: '10 weeks',       dueDays: 70  },
        { vaccine: 'Rotavirus 2',            dueAge: '10 weeks',       dueDays: 70  },
        { vaccine: 'OPV 3',                  dueAge: '14 weeks',       dueDays: 98  },
        { vaccine: 'Pentavalent 3',          dueAge: '14 weeks',       dueDays: 98  },
        { vaccine: 'PCV 3',                  dueAge: '14 weeks',       dueDays: 98  },
        { vaccine: 'IPV',                    dueAge: '14 weeks',       dueDays: 98  },
        { vaccine: 'Vitamin A (1st dose)',   dueAge: '6 months',       dueDays: 180 },
        { vaccine: 'Measles (MR) 1',         dueAge: '9 months',       dueDays: 270 },
        { vaccine: 'Yellow Fever',           dueAge: '9 months',       dueDays: 270 },
        { vaccine: 'Meningococcal A',        dueAge: '9 months',       dueDays: 270 },
        { vaccine: 'Vitamin A (2nd dose)',   dueAge: '12 months',      dueDays: 365 },
        { vaccine: 'Measles (MR) 2',         dueAge: '15 months',      dueDays: 456 },
      ];

      // Mark each item given/pending by matching on vaccine name (case-insensitive)
      const schedule = EPI_SCHEDULE.map(item => {
        const match = given.find(g =>
          g.vaccineName.toLowerCase().includes(item.vaccine.toLowerCase().split(' ')[0])
        );
        return {
          vaccine: item.vaccine,
          dueAge: item.dueAge,
          dueDate: new Date(dob.getTime() + item.dueDays * 24 * 60 * 60 * 1000),
          given: !!match,
          givenDate: match?.administrationDate || null,
          doseNumber: match?.doseNumber || null
        };
      });

      res.json({
        patient: { id: patient.id, ageInDays },
        schedule,
        givenCount: given.length,
        totalCount: schedule.length
      });
    } catch (error) {
      console.error('Paediatric immunization schedule error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// PAEDIATRIC — Developmental milestones
// NOTE: There is no Prisma model for milestones yet, so we
// record them as a special ClinicalNote with type "Milestone".
// This gives you full audit history and no schema migration.
// If you later want a dedicated table, swap the implementation.
// ============================================================
app.post('/api/paediatric/milestone',
  authenticate,
  authorize('Paediatrician', 'Admin', 'Doctor', 'Nurse', 'ITAdmin'),
  async (req, res) => {
    try {
      const { patientId, milestone, ageInMonths, achieved, notes } = req.body;

      if (!patientId || !milestone) {
        return res.status(400).json({ error: 'patientId and milestone are required' });
      }

      const patient = await req.db.patient.findUnique({ where: { id: patientId } });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      const isAchieved = achieved !== false;
      const achievedText = isAchieved ? 'Achieved' : 'Not yet achieved';
      const ageText = ageInMonths ? ` at ${ageInMonths} months` : '';

      const note = await req.db.clinicalNote.create({
        data: {
          patientId,
          authorId: req.user.id,
          type: 'Milestone',
          subjective: `Developmental milestone: ${milestone}`,
          objective: `${achievedText}${ageText}`,
          assessment: isAchieved ? 'Milestone achieved' : 'Milestone delayed',
          plan: notes || '',
          fullContent: `📋 DEVELOPMENTAL MILESTONE\n\n` +
                       `Milestone: ${milestone}\n` +
                       `Status: ${achievedText}${ageText}\n` +
                       `Notes: ${notes || 'None'}\n` +
                       `Recorded by: ${req.user.firstName || ''} ${req.user.lastName || ''} (${req.user.role})`,
          updatedAt: new Date()
        },
        include: {
          Staff: { select: { id: true, firstName: true, lastName: true, role: true } }
        }
      });

      await req.db.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'RECORD_MILESTONE',
          module: 'Paediatrics',
          details: `Recorded milestone "${milestone}" (${achievedText}) for patient ${patient.hospitalId}`
        }
      });

      res.status(201).json({
        message: 'Milestone recorded successfully',
        note: {
          ...note,
          author: note.Staff
        }
      });
    } catch (error) {
      console.error('Record milestone error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// CLINICAL NOTES (SOAP)
// ============================================================
app.get('/api/patients/:patientId/notes', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userRole = req.user.role;
    if (!['Admin', 'ITAdmin', 'Records', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to view clinical notes' });
    }
    const notes = await req.db.clinicalNote.findMany({
      where: { patientId },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const formattedNotes = notes.map(note => ({
      ...note,
      author: note.Staff
        ? {
            ...note.Staff,
            fullName: note.Staff.firstName && note.Staff.lastName
              ? `${note.Staff.firstName} ${note.Staff.lastName}`
              : `${note.Staff.role || 'Unknown'} (ID: ${note.authorId?.slice(0, 8) || 'Unknown'})`
          }
        : { fullName: 'Unknown Staff (Deleted)', role: 'Unknown' }
    }));
    res.json(formattedNotes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clinical-notes', authenticate, authorize('Doctor', 'Nurse', 'Admin', 'Records', 'Obstetrician', 'Midwife', 'Pharmacist', 'LabTechnician', 'Radiologist'), async (req, res) => {
  try {
    const { patientId, type, subjective, objective, assessment, plan, fullContent } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Missing required field: patientId' });
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const note = await req.db.clinicalNote.create({
      data: {
        patientId, authorId: req.user.id, type: type || 'SOAP',
        subjective: subjective || '', objective: objective || '',
        assessment: assessment || '', plan: plan || '',
        fullContent: fullContent || '', updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedNote = { ...note, patient: note.Patient, author: note.Staff };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_NOTE',
        module: 'Clinical',
        details: `Created ${type || 'SOAP'} note for patient ${formattedNote.patient?.hospitalId}`
      }
    });
    res.status(201).json(formattedNote);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/clinical-notes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, subjective, objective, assessment, plan, fullContent } = req.body;
    const existing = await req.db.clinicalNote.findUnique({ where: { id }, include: { Staff: true } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.authorId !== req.user.id && !['Admin', 'ITAdmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only edit your own notes' });
    }
    const note = await req.db.clinicalNote.update({
      where: { id },
      data: { type, subjective, objective, assessment, plan, fullContent, updatedAt: new Date() },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    res.json({ ...note, author: note.Staff });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/clinical-notes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await req.db.clinicalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.authorId !== req.user.id && !['Admin', 'ITAdmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }
    await req.db.clinicalNote.delete({ where: { id } });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_NOTE',
        module: 'Clinical',
        details: `Deleted note ${id}`
      }
    });
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// PRESCRIPTIONS
// ============================================================
app.get('/api/prescriptions', authenticate, async (req, res) => {
  try {
    const prescriptions = await req.db.prescription.findMany({
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_Prescription_prescribingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_Prescription_dispensingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(prescriptions.map(p => ({
      ...p,
      patient: p.Patient,
      prescribedBy: p.Staff_Prescription_prescribingStaffIdToStaff,
      dispensedBy: p.Staff_Prescription_dispensingStaffIdToStaff
    })));
  } catch (error) {
    console.error('Get all prescriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions', authenticate, authorize('Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Admin'), async (req, res) => {
  try {
    const { patientId, medication, dosage, frequency, duration, instructions } = req.body;
    if (!patientId || !medication || !dosage || !frequency) {
      return res.status(400).json({ error: 'Missing required fields: patientId, medication, dosage, frequency' });
    }
    const prescription = await req.db.prescription.create({
      data: {
        patientId, prescribingStaffId: req.user.id, medication, dosage,
        frequency, duration: duration || '', instructions: instructions || '',
        status: 'Prescribed', updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_Prescription_prescribingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedPrescription = {
      ...prescription,
      patient: prescription.Patient,
      prescribedBy: prescription.Staff_Prescription_prescribingStaffIdToStaff
    };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_PRESCRIPTION',
        module: 'Pharmacy',
        details: `Created prescription for ${medication} for patient ${formattedPrescription.patient?.hospitalId}`
      }
    });
    res.status(201).json(formattedPrescription);
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/prescriptions/:id/dispense', authenticate, authorize('Pharmacist'), async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await req.db.prescription.update({
      where: { id },
      data: {
        dispensingStaffId: req.user.id,
        status: 'Dispensed',
        dispensedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_Prescription_prescribingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_Prescription_dispensingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedPrescription = {
      ...prescription,
      patient: prescription.Patient,
      prescribedBy: prescription.Staff_Prescription_prescribingStaffIdToStaff,
      dispensedBy: prescription.Staff_Prescription_dispensingStaffIdToStaff
    };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DISPENSE_PRESCRIPTION',
        module: 'Pharmacy',
        details: `Dispensed prescription ${id} for ${prescription.medication}`
      }
    });
    res.json(formattedPrescription);
  } catch (error) {
    console.error('Dispense prescription error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// LAB ORDERS
// ============================================================
app.get('/api/lab-orders', authenticate, authorize('Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Admin', 'LabTechnician', 'LabScientist', 'Paediatrician'), async (req, res) => {
  try {
    let where = {};
    const { patientId } = req.query;
    if (patientId) where.patientId = patientId;

    const labOrders = await req.db.labOrder.findMany({
      where,
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_LabOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_LabOrder_labStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(labOrders.map(o => ({
      ...o,
      patient: o.Patient,
      orderedBy: o.Staff_LabOrder_orderingStaffIdToStaff,
      performedBy: o.Staff_LabOrder_labStaffIdToStaff
    })));
  } catch (error) {
    console.error('Get all lab orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lab-orders', authenticate, authorize('Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Admin'), async (req, res) => {
  try {
    const { patientId, testName, testType, priority, notes } = req.body;
    if (!patientId || !testName || !testType) {
      return res.status(400).json({ error: 'Missing required fields: patientId, testName, testType' });
    }
    const labOrder = await req.db.labOrder.create({
      data: {
        patientId, orderingStaffId: req.user.id, testName, testType,
        priority: priority || 'Routine', status: 'Ordered',
        notes: notes || null, updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_LabOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedLabOrder = {
      ...labOrder,
      patient: labOrder.Patient,
      orderedBy: labOrder.Staff_LabOrder_orderingStaffIdToStaff
    };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_LAB_ORDER',
        module: 'Lab',
        details: `Created lab order for ${testName} for patient ${formattedLabOrder.patient?.hospitalId}`
      }
    });
    res.status(201).json(formattedLabOrder);
  } catch (error) {
    console.error('Create lab order error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/lab-orders/:id/results', authenticate, authorize('Doctor', 'Nurse', 'LabTechnician', 'LabScientist', 'Admin', 'Paediatrician'), async (req, res) => {
  try {
    const { id } = req.params;
    const { result, status } = req.body;
    if (!result) return res.status(400).json({ error: 'Result is required' });
    const labOrder = await req.db.labOrder.update({
      where: { id },
      data: {
        result,
        status: status || 'Completed',
        resultDate: new Date(),
        labStaffId: req.user.id,
        updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_LabOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_LabOrder_labStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedLabOrder = {
      ...labOrder,
      patient: labOrder.Patient,
      orderedBy: labOrder.Staff_LabOrder_orderingStaffIdToStaff,
      performedBy: labOrder.Staff_LabOrder_labStaffIdToStaff
    };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_LAB_RESULT',
        module: 'Lab',
        details: `Updated lab result for ${labOrder.testName} for patient ${formattedLabOrder.patient?.hospitalId}`
      }
    });
    res.json(formattedLabOrder);
  } catch (error) {
    console.error('Update lab result error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/lab-orders/:id/status', authenticate, authorize('Doctor', 'Nurse', 'LabTechnician', 'LabScientist', 'Admin', 'Paediatrician'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const validStatuses = ['Ordered', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const labOrder = await req.db.labOrder.update({
      where: { id },
      data: {
        status,
        ...(status === 'In Progress' && { labStaffId: req.user.id }),
        ...(status === 'Completed' && { resultDate: new Date(), labStaffId: req.user.id }),
        updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_LabOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_LabOrder_labStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedLabOrder = {
      ...labOrder,
      patient: labOrder.Patient,
      orderedBy: labOrder.Staff_LabOrder_orderingStaffIdToStaff,
      performedBy: labOrder.Staff_LabOrder_labStaffIdToStaff
    };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_LAB_STATUS',
        module: 'Lab',
        details: `Updated lab order ${id} to ${status}`
      }
    });
    res.json(formattedLabOrder);
  } catch (error) {
    console.error('Update lab status error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/lab-orders/:id/validate', authenticate, authorize('LabScientist', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const labOrder = await req.db.labOrder.findUnique({ where: { id } });
    if (!labOrder) return res.status(404).json({ error: 'Lab order not found' });
    if (!labOrder.result) return res.status(400).json({ error: 'Cannot validate an order without results' });

    const updated = await req.db.labOrder.update({
      where: { id },
      data: { validated: true, validatedBy: req.user.id, validatedAt: new Date(), updatedAt: new Date() },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_LabOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_LabOrder_labStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'VALIDATE_LAB_RESULT',
        module: 'Lab',
        details: `Validated lab result for ${labOrder.testName} for patient ${labOrder.patientId}`
      }
    });
    res.json({
      message: '✅ Lab result validated successfully!',
      order: {
        ...updated,
        patient: updated.Patient,
        orderedBy: updated.Staff_LabOrder_orderingStaffIdToStaff,
        performedBy: updated.Staff_LabOrder_labStaffIdToStaff
      }
    });
  } catch (error) {
    console.error('Validate lab result error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// IMAGING ORDERS
// ============================================================
app.get('/api/imaging-orders', authenticate, async (req, res) => {
  try {
    const { status, patientId, dateFrom, dateTo, imagingType } = req.query;
    const userRole = req.user.role;
    const staffId = req.user.id;
    let where = {};
    if (['Doctor', 'Obstetrician'].includes(userRole)) {
      where.orderingStaffId = staffId;
    } else if (['Admin', 'Records', 'ITAdmin'].includes(userRole)) {
      // all
    } else if (['Radiologist'].includes(userRole)) {
      where.status = { not: 'Cancelled' };
    }
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (imagingType) where.imagingType = imagingType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59');
    }

    const imagingOrders = await req.db.imagingOrder.findMany({
      where,
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true } },
        Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_ImagingOrder_radiologistIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        ImagingResult: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedOrders = imagingOrders.map(order => {
      const rawImages = order.images || order.imagesUrl || '';
      const imageArray = rawImages ? rawImages.split(',').filter(u => u && u.trim() !== '') : [];
      return {
        ...order,
        patient: order.Patient,
        orderingStaff: order.Staff_ImagingOrder_orderingStaffIdToStaff,
        radiologist: order.Staff_ImagingOrder_radiologistIdToStaff,
        imagingResults: order.ImagingResult,
        images: rawImages,
        imageArray,
        imageCount: imageArray.length,
        hasImages: imageArray.length > 0,
        status: order.status || 'Ordered'
      };
    });
    res.json(formattedOrders);
  } catch (error) {
    console.error('❌ Get imaging orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imaging-orders', authenticate, authorize('Doctor', 'Obstetrician'), async (req, res) => {
  try {
    const { patientId, imagingType, bodyPart, priority, clinicalHistory, clinicalQuestion, notes } = req.body;
    if (!patientId || !imagingType || !bodyPart) {
      return res.status(400).json({ error: 'Patient ID, Imaging Type, and Body Part are required' });
    }
    const count = await req.db.imagingOrder.count();
    const orderNumber = `IMG-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const order = await req.db.imagingOrder.create({
      data: {
        orderNumber, patientId, imagingType, bodyPart,
        priority: priority || 'Routine',
        clinicalHistory: clinicalHistory || null,
        clinicalQuestion: clinicalQuestion || null,
        orderingStaffId: req.user.id,
        status: 'Ordered', notes: notes || null, updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true } },
        Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedOrder = {
      ...order,
      patient: order.Patient,
      orderingStaff: order.Staff_ImagingOrder_orderingStaffIdToStaff
    };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_IMAGING_ORDER',
        module: 'Radiology',
        details: `Created ${imagingType} order for patient ${formattedOrder.patient?.hospitalId} - ${order.orderNumber}`
      }
    });
    res.status(201).json(formattedOrder);
  } catch (error) {
    console.error('Create imaging order error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/imaging-orders/:id/status', authenticate, authorize('Admin', 'Radiologist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const validStatuses = ['Ordered', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` });
    }

    // Look at the current order so we can preserve the original radiologist
    const existing = await req.db.imagingOrder.findUnique({
      where: { id },
      select: { radiologistId: true },
    });

    const order = await req.db.imagingOrder.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
        ...(status === 'Completed' && { resultDate: new Date() }),
        // Assign the radiologist when work starts, and keep whoever was
        // first assigned if the status changes again later.
        ...(['Scheduled', 'In Progress', 'Completed'].includes(status) && {
          radiologistId: existing?.radiologistId || req.user.id,
        }),
        updatedAt: new Date()
      },   include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_ImagingOrder_radiologistIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    const formattedOrder = {
      ...order,
      patient: order.Patient,
      orderingStaff: order.Staff_ImagingOrder_orderingStaffIdToStaff,
      radiologist: order.Staff_ImagingOrder_radiologistIdToStaff
    };
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_IMAGING_STATUS',
        module: 'Radiology',
        details: `Updated imaging order ${order.orderNumber} to ${status}`
      }
    });
    res.json(formattedOrder);
  } catch (error) {
    console.error('Update imaging status error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/imaging-orders/:id/results', authenticate, authorize('Radiologist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { findings, impression, recommendations, severity, imagesUrl } = req.body;
    if (!findings || !impression) return res.status(400).json({ error: 'Findings and Impression are required' });

    const updateData = {
      result: findings, report: impression,
      status: 'Completed', resultDate: new Date(),
      radiologistId: req.user.id, updatedAt: new Date()
    };
    if (imagesUrl) updateData.imagesUrl = imagesUrl;

    const order = await req.db.imagingOrder.update({
      where: { id },
      data: updateData,
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_ImagingOrder_radiologistIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });

    await req.db.imagingResult.create({
      data: {
        imagingOrderId: id, findings, impression,
        recommendations: recommendations || null,
        severity: severity || 'Normal', updatedAt: new Date()
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'SUBMIT_IMAGING_RESULTS',
        module: 'Radiology',
        details: `Submitted results for imaging order ${order.orderNumber}`
      }
    });

    res.json({
      message: 'Results submitted successfully',
      order: {
        ...order,
        patient: order.Patient,
        orderingStaff: order.Staff_ImagingOrder_orderingStaffIdToStaff,
        radiologist: order.Staff_ImagingOrder_radiologistIdToStaff
      }
    });
  } catch (error) {
    console.error('Submit imaging results error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/imaging-orders/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await req.db.imagingOrder.findUnique({
      where: { id },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, email: true } },
        Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Staff_ImagingOrder_radiologistIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        ImagingResult: true
      }
    });
    if (!order) return res.status(404).json({ error: 'Imaging order not found' });

    res.json({
      ...order,
      patient: order.Patient,
      orderingStaff: order.Staff_ImagingOrder_orderingStaffIdToStaff,
      radiologist: order.Staff_ImagingOrder_radiologistIdToStaff,
      imagingResults: order.ImagingResult
    });
  } catch (error) {
    console.error('Get imaging order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/imaging-orders/:id/cancel', authenticate, authorize('Doctor', 'Obstetrician', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const order = await req.db.imagingOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Imaging order not found' });
    if (order.status === 'Completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed imaging order' });
    }
    const updatedOrder = await req.db.imagingOrder.update({
      where: { id },
      data: {
        status: 'Cancelled',
        notes: reason ? `Cancelled: ${reason}` : order.notes,
        updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CANCEL_IMAGING_ORDER',
        module: 'Radiology',
        details: `Cancelled imaging order ${order.orderNumber}. Reason: ${reason || 'Not specified'}`
      }
    });
    res.json({
      message: 'Imaging order cancelled successfully',
      order: { ...updatedOrder, patient: updatedOrder.Patient, orderingStaff: updatedOrder.Staff_ImagingOrder_orderingStaffIdToStaff }
    });
  } catch (error) {
    console.error('Cancel imaging order error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// IMAGING IMAGE UPLOAD
// ============================================================
const upload2 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/dicom',
    ];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only images are allowed.'), false);
  },
});

app.post('/api/imaging-orders/:id/upload-images',
  authenticate, authorize('Radiologist', 'Admin'),
  upload2.array('images', 10),
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log(`\n📥 Upload request for imaging order ${id}`);

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
      }

      // --- DEBUG: what did multer hand us? ---
      console.log('📎 Files received from multer:', req.files.map(f => ({
        name: f.originalname,
        size: f.size,
        mime: f.mimetype,
        hasBuffer: !!f.buffer,
        bufferLength: f.buffer?.length,
      })));

      const order = await req.db.imagingOrder.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: 'Imaging order not found' });

      const uploaded = [];
      for (const file of req.files) {
        try {
          // --- DEBUG: handing off to storage ---
          console.log(`📤 Handing off to storage: ${file.originalname} (${file.buffer?.length || 0} bytes)`);

          const result = await storage.uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype
          );

          // --- DEBUG: storage returned successfully ---
          console.log(`✅ Storage returned: ${result.url}`);

          uploaded.push(result.url);
        } catch (uploadErr) {
          console.error(`❌ Upload failed for ${file.originalname}:`, uploadErr);
          for (const url of uploaded) {
            try { await storage.deleteFile(url); } catch {}
          }
          return res.status(500).json({
            error: `Upload failed for ${file.originalname}: ${uploadErr.message}`,
          });
        }
      }

      const existingImages = order.images && order.images.length > 0
        ? order.images.split(',').filter((s) => s.trim() !== '')
        : [];
      const allImages = [...existingImages, ...uploaded];
      const imagesString = allImages.join(',');

      await req.db.imagingOrder.update({
        where: { id },
        data: {
          images: imagesString,
          imageCount: allImages.length,
          hasImages: true,
          updatedAt: new Date(),
        },
      });

      const completeOrder = await req.db.imagingOrder.findUnique({
        where: { id },
        include: {
          Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
          Staff_ImagingOrder_orderingStaffIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
          Staff_ImagingOrder_radiologistIdToStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
          ImagingResult: true,
        },
      });

      await req.db.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'UPLOAD_IMAGING_IMAGES',
          module: 'Radiology',
          details: `Uploaded ${req.files.length} image(s) to ${storage.backend} for imaging order ${order.orderNumber}`,
        },
      });

      console.log(`✅ Imaging order ${id} updated with ${uploaded.length} new image(s)\n`);

      res.json({
        message: `${req.files.length} image(s) uploaded successfully`,
        order: {
          ...completeOrder,
          patient: completeOrder.Patient,
          orderingStaff: completeOrder.Staff_ImagingOrder_orderingStaffIdToStaff,
          radiologist: completeOrder.Staff_ImagingOrder_radiologistIdToStaff,
          imagingResults: completeOrder.ImagingResult,
          images: imagesString,
          imageCount: allImages.length,
          hasImages: true,
        },
      });
    } catch (error) {
      console.error('❌ Image upload error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// BILLING
// ============================================================
app.get('/api/billing', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
    let where = {};
    if (status && status !== 'All') where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59');
    }
    let patientFilter = {};
    if (search) {
      patientFilter = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { hospitalId: { contains: search, mode: 'insensitive' } }
        ]
      };
    }
    const bills = await req.db.billingRecord.findMany({
      where: { ...where, Patient: patientFilter },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, patientCategory: true } },
        PatientJourney: true,
        Staff: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await req.db.billingRecord.count({ where: { ...where, Patient: patientFilter } });
    res.json({
      data: bills.map(b => ({ ...b, patient: b.Patient, journey: b.PatientJourney, staff: b.Staff })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get billing records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/billing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await req.db.billingRecord.findUnique({
      where: { id },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, patientCategory: true } },
        PatientJourney: true,
        PaymentPlan: { include: { PartialPayment: true } },
        Staff: true,
        WalletTransaction: true,
        ImagingOrder: true
      }
    });
    if (!bill) return res.status(404).json({ error: 'Billing record not found' });
    res.json({
      ...bill,
      patient: bill.Patient,
      journey: bill.PatientJourney,
      paymentPlans: bill.PaymentPlan,
      staff: bill.Staff
    });
  } catch (error) {
    console.error('Get billing detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/billing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod, paymentDate, notes } = req.body;
    const bill = await req.db.billingRecord.update({
      where: { id },
      data: {
        status: status || undefined,
        paymentMethod: paymentMethod || undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        updatedAt: new Date()
      },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, patientCategory: true } } }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_BILLING',
        module: 'Billing',
        details: `Updated billing record ${bill.invoiceNumber} to ${status || 'updated'}`
      }
    });
    res.json({ ...bill, patient: bill.Patient });
  } catch (error) {
    console.error('Update billing error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/billing/pending', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const pendingBills = await req.db.billingRecord.findMany({
      where: { status: { in: ['Pending', 'Partial'] } },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, patientCategory: true } },
        PatientJourney: true,
        Staff: true
      },
      orderBy: { createdAt: 'asc' }
    });
    const patientIds = pendingBills.map(b => b.Patient?.id).filter(Boolean);
    const wallets = await req.db.patientWallet.findMany({ where: { patientId: { in: patientIds } } });
    const walletMap = {};
    wallets.forEach(w => { walletMap[w.patientId] = w.balance; });
    const formattedBills = pendingBills.map(bill => {
      const items = bill.items || [];
      const totalPending = bill.balance || 0;
      return {
        ...bill,
        patient: bill.Patient,
        journey: bill.PatientJourney,
        staff: bill.Staff,
        walletBalance: walletMap[bill.Patient?.id] || 0,
        itemizedSummary: {
          items: items.map(i => ({ ...i, isPaid: i.status === 'Paid' })),
          totalPending,
          totalAmount: bill.totalAmount,
          paidAmount: bill.paidAmount,
          balance: bill.balance
        }
      };
    });
    res.json(formattedBills);
  } catch (error) {
    console.error('Get pending bills error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// BILLING PROCESS PAYMENT
// ============================================================
app.post('/api/billing/process-payment', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { billingRecordId, paymentMethod, amount, paymentReference, notes } = req.body;
    if (!billingRecordId) return res.status(400).json({ error: 'Billing record ID is required' });

    const bill = await req.db.billingRecord.findUnique({
      where: { id: billingRecordId },
      include: { Patient: true, PatientJourney: true }
    });
    if (!bill) return res.status(404).json({ error: 'Billing record not found' });
    if (bill.status === 'Paid') return res.status(400).json({ error: 'This bill is already fully paid' });

    const paymentAmount = amount || bill.balance;
    if (paymentAmount > bill.balance) {
      return res.status(400).json({ error: `Amount exceeds balance. Balance: ₦${bill.balance.toLocaleString()}` });
    }
    const staff = await req.db.staff.findUnique({
      where: { id: req.user.id },
      select: { firstName: true, lastName: true, username: true, role: true }
    });
    let staffName = 'Unknown Staff';
    if (staff) {
      staffName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.username || staff.role || 'Unknown Staff';
    }

    let walletTransaction = null;
    let cashAmountPaid = 0;
    let walletAmountPaid = 0;

    if (paymentMethod === 'Wallet') {
      const result = await deductFromWallet(
        bill.patientId, paymentAmount,
        `Payment for ${bill.invoiceNumber} - ${bill.description || 'Billing'}`,
        'Billing', bill.id, 'billing', req.user.id,
        req.tenantId
      );
      if (!result.success) {
        return res.status(400).json({
          error: result.error, code: result.code,
          balance: result.balance, shortfall: result.shortfall
        });
      }
      walletTransaction = result.transaction;
      walletAmountPaid = paymentAmount;
    } else {
      cashAmountPaid = paymentAmount;
    }

    const items = bill.items || [];
    let updatedItems = [...items];
    let remainingAmount = paymentAmount;
    for (let i = 0; i < updatedItems.length && remainingAmount > 0; i++) {
      if (updatedItems[i].status === 'Pending') {
        const itemAmount = updatedItems[i].amount;
        const toPay = Math.min(remainingAmount, itemAmount);
        updatedItems[i].status = 'Paid';
        updatedItems[i].paidAt = new Date().toISOString();
        updatedItems[i].paidAmount = toPay;
        remainingAmount -= toPay;
      }
    }

    const newPaidAmount = bill.paidAmount + paymentAmount;
    const newBalance = bill.totalAmount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

    const updatedBill = await req.db.billingRecord.update({
      where: { id: billingRecordId },
      data: {
        items: updatedItems,
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
        paymentMethod: paymentMethod || undefined,
        paymentDate: new Date(),
        isWalletPayment: paymentMethod === 'Wallet',
        walletTransactionId: walletTransaction?.id || null,
        cashAmountPaid: cashAmountPaid > 0 ? cashAmountPaid : null,
        walletAmountPaid: walletAmountPaid > 0 ? walletAmountPaid : null,
        paymentReference: paymentReference || null,
        processedBy: req.user.id,
        receiptGenerated: true,
        receiptGeneratedAt: new Date(),
        updatedAt: new Date()
      },
      include: { Patient: true, PatientJourney: true }
    });

        // NOTE: We do NOT auto-advance the journey here. The Records officer
    // must explicitly advance the journey after verifying the bill is Paid.
    const autoAdvanced = false;

    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'PROCESS_PAYMENT',
        module: 'Billing',
        details: `Processed ${paymentMethod} payment of ₦${paymentAmount.toLocaleString()} for ${bill.invoiceNumber} by ${staffName}`
      }
    });

    res.json({
      success: true,
      message: `✅ Payment of ₦${paymentAmount.toLocaleString()} processed successfully by ${staffName}`,
      bill: { ...updatedBill, patient: updatedBill.Patient, journey: updatedBill.PatientJourney },
      receipt: {
        number: receiptNumber,
        date: new Date().toISOString(),
        issuedBy: staffName,
        patient: {
          name: `${bill.Patient?.firstName || ''} ${bill.Patient?.lastName || ''}`.trim() || 'Unknown',
          hospitalId: bill.Patient?.hospitalId || 'N/A'
        },
        items: updatedItems,
        totalAmount: bill.totalAmount,
        paidAmount: newPaidAmount,
        balance: newBalance,
        paymentMethod: paymentMethod || 'Cash',
        status: newStatus,
        invoiceNumber: bill.invoiceNumber,
        autoAdvanced
      },
      walletTransaction,
      autoAdvanced,
      staffName
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// BILLING OFFICER
// ============================================================
app.get('/api/billing-officer/pending', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const pendingJourneys = await req.db.patientJourney.findMany({
      where: { status: 'PENDING_BILLING' },
      include: {
        Patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true,
            patientCategory: true, insuranceProvider: true, insuranceId: true, corporateCompany: true
          }
        },
        Clinic: { select: { name: true } },
        Ward: { select: { name: true } },
        Staff: { select: { firstName: true, lastName: true } },
        BillingRecord: true
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(pendingJourneys.map(j => ({
      ...j,
      patient: j.Patient,
      clinic: j.Clinic,
      ward: j.Ward,
      registeredBy: j.Staff,
      billingRecord: j.BillingRecord
    })));
  } catch (error) {
    console.error('Error fetching pending billing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing-officer/process-payment', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { journeyId, paymentMethod } = req.body;
    if (!journeyId) return res.status(400).json({ error: 'Journey ID is required' });
    const journey = await req.db.patientJourney.findUnique({
      where: { id: journeyId },
      include: { Patient: true, BillingRecord: true }
    });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });
    if (journey.status !== 'PENDING_BILLING') {
      return res.status(400).json({ error: 'Journey is not in pending billing status' });
    }
    let bill = journey.BillingRecord;
    if (!bill) {
      const amount = 5000;
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const invoiceNumber = `INV-${new Date().getFullYear()}-${timestamp}-${random}`;
      bill = await req.db.billingRecord.create({
        data: {
          patientId: journey.patientId,
          invoiceNumber,
          description: 'General Consultation',
          items: [{ name: 'Consultation Fee', category: 'Consultation', amount, status: 'Pending', serviceType: 'CONSULTATION' }],
          totalAmount: amount, balance: amount,
          status: 'Pending'
        }
      });
      await req.db.patientJourney.update({
        where: { id: journeyId },
        data: { billingRecordId: bill.id }
      });
    }
        const updatedBill = await req.db.billingRecord.update({
      where: { id: bill.id },
      data: { status: 'Paid', paymentMethod: paymentMethod || 'Cash', paymentDate: new Date() }
    });

    // ✅ Do NOT advance the journey here.
    // The Records officer will advance it from PENDING_BILLING → BILLING_CLEARED
    // once they verify the bill is Paid.

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'BILLING_PAID',
        module: 'Billing',
        details: `Marked bill ${updatedBill.invoiceNumber} as paid for patient ${journey.Patient.hospitalId}. ` +
          `Journey remains PENDING_BILLING until Records advances it.`
      }
    });

    res.json({
      bill: { ...updatedBill, patient: journey.Patient },
      journey, // unchanged — still PENDING_BILLING
      message: 'Bill marked as Paid. Records officer must now advance the journey.'
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PHARMACY - MEDICATIONS
// ============================================================
app.get('/api/medications', authenticate, async (req, res) => {
  try {
    const medications = await req.db.medication.findMany({ orderBy: { name: 'asc' } });
    res.json(medications);
  } catch (error) {
    console.error('Get medications error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/medications', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { name, genericName, category, supplier, unitPrice, stockQuantity, reorderLevel, expiryDate, batchNumber } = req.body;
    if (!name || !category || !unitPrice || !stockQuantity || !expiryDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const medication = await req.db.medication.create({
      data: {
        name, genericName, category, supplier,
        unitPrice: parseFloat(unitPrice) || 0,
        stockQuantity: parseInt(stockQuantity) || 0,
        reorderLevel: parseInt(reorderLevel) || 10,
        expiryDate: new Date(expiryDate), batchNumber
      }
    });
    await req.db.medicationTransaction.create({
      data: {
        medicationId: medication.id, transactionType: 'Purchase',
        quantity: parseInt(stockQuantity) || 0,
        unitPrice: parseFloat(unitPrice) || 0,
        note: 'Initial stock', staffId: req.user.id
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_MEDICATION',
        module: 'Pharmacy',
        details: `Added medication ${name} with quantity ${stockQuantity}`
      }
    });
    res.status(201).json(medication);
  } catch (error) {
    console.error('Create medication error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/medications/:id', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, genericName, category, supplier, unitPrice, stockQuantity, reorderLevel, expiryDate, batchNumber } = req.body;
    if (!name || !category || !unitPrice || !stockQuantity || !expiryDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existingMedication = await req.db.medication.findUnique({ where: { id } });
    if (!existingMedication) return res.status(404).json({ error: 'Medication not found' });

    const medication = await req.db.medication.update({
      where: { id },
      data: {
        name: name.trim(),
        genericName: genericName ? genericName.trim() : null,
        category: category.trim(),
        supplier: supplier ? supplier.trim() : null,
        unitPrice: parseFloat(unitPrice) || 0,
        stockQuantity: parseInt(stockQuantity) || 0,
        reorderLevel: parseInt(reorderLevel) || 10,
        expiryDate: new Date(expiryDate),
        batchNumber: batchNumber ? batchNumber.trim() : null
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_MEDICATION',
        module: 'Pharmacy',
        details: `Updated medication ${medication.name} (${medication.id})`
      }
    });
    res.json(medication);
  } catch (error) {
    console.error('Update medication error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/medications/:id', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { id } = req.params;
    const existingMedication = await req.db.medication.findUnique({ where: { id } });
    if (!existingMedication) return res.status(404).json({ error: 'Medication not found' });
    const transactions = await req.db.medicationTransaction.count({ where: { medicationId: id } });
    if (transactions > 0) {
      return res.status(400).json({ error: 'Cannot delete medication with transaction history.' });
    }
    await req.db.medication.delete({ where: { id } });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_MEDICATION',
        module: 'Pharmacy',
        details: `Deleted medication ${existingMedication.name}`
      }
    });
    res.json({ message: 'Medication deleted successfully' });
  } catch (error) {
    console.error('Delete medication error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// PHARMACY DASHBOARD
// ============================================================
app.get('/api/pharmacy/dashboard', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const lowStockRaw = await req.db.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "Medication"
      WHERE "stockQuantity" <= "reorderLevel"
        AND "tenantId" = ${req.tenantId}
    `;
    const lowStock = lowStockRaw[0]?.count ?? 0;

    const [totalMedications, totalTransactions, pendingAuthorizations] = await Promise.all([
      req.db.medication.count(),
      req.db.medicationTransaction.count(),
      req.db.nHISAuthorization.count({ where: { status: 'Pending' } })
    ]);

    const recentTransactions = await req.db.medicationTransaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { Medication: { select: { id: true, name: true } } }
    });
    const pendingAuths = await req.db.nHISAuthorization.findMany({
      take: 10,
      where: { status: 'Pending' },
      include: { Patient: { select: { id: true, firstName: true, lastName: true, hospitalId: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json({
      statistics: { totalMedications, lowStock, totalTransactions, pendingAuthorizations },
      recentTransactions: recentTransactions.map(t => ({ ...t, medication: t.Medication })) || [],
      pendingAuths: pendingAuths.map(a => ({ ...a, patient: a.Patient })) || []
    });
  } catch (error) {
    console.error('Pharmacy dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// NHIS DRUG MANAGEMENT
// ============================================================
app.get('/api/pharmacy/nhis-prices', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist', 'Accountant'), async (req, res) => {
  try {
    const prices = await req.db.nHISDrugPrice.findMany({
      include: {
        Medication: {
          select: { id: true, name: true, genericName: true, category: true, unitPrice: true, stockQuantity: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(prices.map(p => ({ ...p, medication: p.Medication })));
  } catch (error) {
    console.error('Get NHIS prices error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pharmacy/nhis-prices', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const {
      medicationId, nhisCode, nhisName, standardPrice, nhisPrice, patientCopay,
      maxQuantity, refillLimit, validityPeriod, drugClass, requiresPriorAuth,
      effectiveDate, expiryDate
    } = req.body;
    if (!medicationId || !nhisCode || !standardPrice || !nhisPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const calculatedPatientCopay = patientCopay || (nhisPrice * 0.1);

    const price = await req.db.nHISDrugPrice.upsert({
      where: {
        tenantId_medicationId_nhisCode: {
          tenantId: req.tenantId,
          medicationId,
          nhisCode
        }
      },
      update: {
        nhisName: nhisName || null,
        standardPrice: parseFloat(standardPrice) || 0,
        nhisPrice: parseFloat(nhisPrice) || 0,
        patientCopay: parseFloat(calculatedPatientCopay) || 0,
        nhisCoverage: parseFloat(nhisPrice) * 0.9 || 0,
        maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
        refillLimit: refillLimit ? parseInt(refillLimit) : 3,
        validityPeriod: validityPeriod ? parseInt(validityPeriod) : 30,
        drugClass: drugClass || null,
        requiresPriorAuth: requiresPriorAuth || false,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: true, updatedAt: new Date()
      },
      create: {
        medicationId, nhisCode,
        nhisName: nhisName || null,
        standardPrice: parseFloat(standardPrice) || 0,
        nhisPrice: parseFloat(nhisPrice) || 0,
        patientCopay: parseFloat(calculatedPatientCopay) || 0,
        nhisCoverage: parseFloat(nhisPrice) * 0.9 || 0,
        maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
        refillLimit: refillLimit ? parseInt(refillLimit) : 3,
        validityPeriod: validityPeriod ? parseInt(validityPeriod) : 30,
        drugClass: drugClass || null,
        requiresPriorAuth: requiresPriorAuth || false,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: true, updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_NHIS_PRICE',
        module: 'Pharmacy',
        details: `Updated NHIS price for medication ${medicationId}`
      }
    });
    res.json({ message: 'NHIS price saved successfully', price });
  } catch (error) {
    console.error('Save NHIS price error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/pharmacy/nhis-prices/:id', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    const price = await req.db.nHISDrugPrice.findUnique({
      where: { id },
      include: {
        Medication: {
          select: { id: true, name: true, genericName: true, category: true, unitPrice: true, stockQuantity: true }
        }
      }
    });
    if (!price) return res.status(404).json({ error: 'NHIS price not found' });
    res.json({ ...price, medication: price.Medication });
  } catch (error) {
    console.error('Get NHIS price error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pharmacy/nhis-prices/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    await req.db.nHISDrugPrice.delete({ where: { id } });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_NHIS_PRICE',
        module: 'Pharmacy',
        details: `Deleted NHIS price ${id}`
      }
    });
    res.json({ message: 'NHIS price deleted successfully' });
  } catch (error) {
    console.error('Delete NHIS price error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/pharmacy/transactions', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const transactions = await req.db.medicationTransaction.findMany({
      include: { Medication: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(transactions.map(t => ({ ...t, medication: t.Medication })));
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PHARMACY STOCK MANAGEMENT
// ============================================================
app.get('/api/medications/search/:name', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { name } = req.params;
    const medications = await req.db.medication.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      orderBy: { name: 'asc' }
    });
    res.json(medications);
  } catch (error) {
    console.error('Search medications error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/medications/:id/stock', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, transactionType, note, patientId } = req.body;
    if (!quantity || !transactionType) {
      return res.status(400).json({ error: 'Missing required fields: quantity, transactionType' });
    }
    const medication = await req.db.medication.findUnique({ where: { id } });
    if (!medication) return res.status(404).json({ error: 'Medication not found' });

    let newStock = medication.stockQuantity;
    const validTypes = ['Purchase', 'Dispensed', 'Returned', 'Adjusted', 'Damaged', 'Expired'];
    if (!validTypes.includes(transactionType)) {
      return res.status(400).json({ error: `Invalid transaction type. Valid: ${validTypes.join(', ')}` });
    }

    if (transactionType === 'Purchase' || transactionType === 'Returned') {
      newStock += quantity;
    } else if (['Dispensed', 'Adjusted', 'Damaged', 'Expired'].includes(transactionType)) {
      if (medication.stockQuantity < quantity) {
        return res.status(400).json({
          error: `Insufficient stock. Available: ${medication.stockQuantity}, Required: ${quantity}`,
          available: medication.stockQuantity,
          required: quantity
        });
      }
      newStock -= quantity;
    }

    const result = await req.db.$transaction(async (tx) => {
      const updatedMedication = await tx.medication.update({
        where: { id },
        data: { stockQuantity: newStock, updatedAt: new Date() }
      });
      const transaction = await tx.medicationTransaction.create({
        data: {
          medicationId: id,
          transactionType,
          quantity: parseInt(quantity) || 0,
          unitPrice: medication.unitPrice,
          totalPrice: (parseInt(quantity) || 0) * medication.unitPrice,
          note: note || `Stock ${transactionType}`,
          staffId: req.user.id,
          reference: `${transactionType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          patientId: patientId || null,
          createdAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'UPDATE_STOCK',
          module: 'Pharmacy',
          details: `Updated stock for ${medication.name}: ${transactionType} ${quantity} units. New stock: ${newStock}`
        }
      });
      return { updatedMedication, transaction };
    });

    res.json({
      message: `Stock updated successfully: ${transactionType} ${quantity} units`,
      medication: result.updatedMedication,
      transaction: result.transaction,
      newStock: result.updatedMedication.stockQuantity,
      isLowStock: result.updatedMedication.stockQuantity <= result.updatedMedication.reorderLevel
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/medications/stock/:name', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist', 'Doctor'), async (req, res) => {
  try {
    const { name } = req.params;
    const medication = await req.db.medication.findFirst({
      where: { name: { contains: name, mode: 'insensitive' } },
      select: {
        id: true, name: true, genericName: true,
        stockQuantity: true, reorderLevel: true,
        unitPrice: true, expiryDate: true
      }
    });
    if (!medication) return res.status(404).json({ error: 'Medication not found' });
    res.json({
      ...medication,
      isLowStock: medication.stockQuantity <= medication.reorderLevel,
      isOutOfStock: medication.stockQuantity <= 0
    });
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SERVICE PRICING
// ============================================================
app.get('/api/pricing', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const pricing = await req.db.servicePricing.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(pricing);
  } catch (error) {
    console.error('GET /api/pricing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pricing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
    const pricing = await req.db.servicePricing.findUnique({ where: { id } });
    if (!pricing) return res.status(404).json({ error: 'Service not found' });
    res.json(pricing);
  } catch (error) {
    console.error('GET /api/pricing/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pricing', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { name, description, category, basePrice, nhisPrice, corporatePrice, isActive } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!basePrice) return res.status(400).json({ error: 'Base price is required' });
    const existing = await req.db.servicePricing.findFirst({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Service name already exists' });

    const basePriceNum = parseFloat(basePrice) || 0;
    const pricing = await req.db.servicePricing.create({
      data: {
        name, description: description || '', category: category || 'FPP',
        basePrice: basePriceNum,
        nhisPrice: parseFloat(nhisPrice) || (basePriceNum * 0.1),
        corporatePrice: parseFloat(corporatePrice) || (basePriceNum * 2),
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_SERVICE_PRICE',
        module: 'Pricing',
        details: `Created service price ${name} - ₦${basePrice}`
      }
    });
    res.status(201).json(pricing);
  } catch (error) {
    console.error('POST /api/pricing error:', error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Service name already exists' });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pricing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
    const { name, description, category, basePrice, nhisPrice, corporatePrice, isActive } = req.body;
    const basePriceNum = parseFloat(basePrice) || 0;
    const pricing = await req.db.servicePricing.update({
      where: { id },
      data: {
        name, description: description || '', category: category || 'FPP',
        basePrice: basePriceNum,
        nhisPrice: parseFloat(nhisPrice) || (basePriceNum * 0.1),
        corporatePrice: parseFloat(corporatePrice) || (basePriceNum * 2),
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_SERVICE_PRICE',
        module: 'Pricing',
        details: `Updated service price ${name} - ₦${basePrice}`
      }
    });
    res.json(pricing);
  } catch (error) {
    console.error('PUT /api/pricing/:id error:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Service not found' });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pricing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
    await req.db.servicePricing.delete({ where: { id } });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_SERVICE_PRICE',
        module: 'Pricing',
        details: `Deleted service price ${id}`
      }
    });
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/pricing/:id error:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Service not found' });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SERVICES
// ============================================================
app.get('/api/services', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer', 'Doctor', 'Nurse', 'LabTechnician', 'Radiologist', 'LabScientist'), async (req, res) => {
  try {
    const { category, search, isActive } = req.query;
    let where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    const services = await req.db.servicePricing.findMany({ where, orderBy: { name: 'asc' } });
    res.json(services);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/services/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const service = await req.db.servicePricing.findUnique({ where: { id } });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { name, code, description, category, basePrice, nhisPrice, corporatePrice, isActive, requiresApproval } = req.body;
    if (!name || !category || basePrice === undefined) {
      return res.status(400).json({ error: 'Name, category, and base price are required' });
    }
    const existing = await req.db.servicePricing.findFirst({
      where: { OR: [{ name: name.trim() }, { code: code ? code.trim() : undefined }] }
    });
    if (existing) return res.status(400).json({ error: 'Service with this name or code already exists' });

    const service = await req.db.servicePricing.create({
      data: {
        name: name.trim(),
        code: code ? code.trim() : null,
        description: description || null,
        category,
        basePrice: parseFloat(basePrice) || 0,
        nhisPrice: nhisPrice !== undefined ? parseFloat(nhisPrice) : (parseFloat(basePrice) * 0.1),
        corporatePrice: corporatePrice !== undefined ? parseFloat(corporatePrice) : (parseFloat(basePrice) * 2),
        isActive: isActive !== undefined ? isActive : true,
        requiresApproval: requiresApproval || false,
        updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_SERVICE',
        module: 'Pricing',
        details: `Created service ${service.name} (${service.category}) - ₦${service.basePrice}`
      }
    });
    res.status(201).json(service);
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, category, basePrice, nhisPrice, corporatePrice, isActive, requiresApproval } = req.body;
    const existing = await req.db.servicePricing.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Service not found' });

    if (name || code) {
      const duplicate = await req.db.servicePricing.findFirst({
        where: {
          OR: [name ? { name: name.trim() } : {}, code ? { code: code.trim() } : {}],
          NOT: { id }
        }
      });
      if (duplicate) return res.status(400).json({ error: 'Service with this name or code already exists' });
    }

    const service = await req.db.servicePricing.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        code: code ? code.trim() : null,
        description: description || null,
        category: category || undefined,
        basePrice: basePrice !== undefined ? parseFloat(basePrice) : undefined,
        nhisPrice: nhisPrice !== undefined ? parseFloat(nhisPrice) : undefined,
        corporatePrice: corporatePrice !== undefined ? parseFloat(corporatePrice) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        requiresApproval: requiresApproval !== undefined ? requiresApproval : undefined,
        updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_SERVICE',
        module: 'Pricing',
        details: `Updated service ${service.name} - ₦${service.basePrice}`
      }
    });
    res.json(service);
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    const service = await req.db.servicePricing.findUnique({ where: { id } });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    await req.db.servicePricing.delete({ where: { id } });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_SERVICE',
        module: 'Pricing',
        details: `Deleted service ${service.name}`
      }
    });
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/services/categories', authenticate, async (req, res) => {
  try {
    const categories = await req.db.servicePricing.groupBy({
      by: ['category'],
      _count: { category: true }
    });
    res.json(categories.map(c => ({ name: c.category, count: c._count.category })));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services/bulk', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { services } = req.body;
    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'Services array is required' });
    }
    const results = { created: 0, updated: 0, errors: [] };
    for (const serviceData of services) {
      try {
        const { name, code, category, basePrice, nhisPrice, corporatePrice, description } = serviceData;
        if (!name || !category || basePrice === undefined) {
          results.errors.push({ name, error: 'Missing required fields' });
          continue;
        }
        const existing = await req.db.servicePricing.findFirst({
          where: { OR: [{ name: name.trim() }, code ? { code: code.trim() } : {}] }
        });
        if (existing) {
          await req.db.servicePricing.update({
            where: { id: existing.id },
            data: {
              basePrice: parseFloat(basePrice) || existing.basePrice,
              nhisPrice: parseFloat(nhisPrice) || (parseFloat(basePrice) * 0.1),
              corporatePrice: parseFloat(corporatePrice) || (parseFloat(basePrice) * 2),
              description: description || existing.description,
              isActive: true, updatedAt: new Date()
            }
          });
          results.updated++;
        } else {
          await req.db.servicePricing.create({
            data: {
              name: name.trim(),
              code: code ? code.trim() : null,
              category,
              basePrice: parseFloat(basePrice) || 0,
              nhisPrice: parseFloat(nhisPrice) || (parseFloat(basePrice) * 0.1),
              corporatePrice: parseFloat(corporatePrice) || (parseFloat(basePrice) * 2),
              description: description || null,
              isActive: true, updatedAt: new Date()
            }
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push({ name: serviceData.name, error: error.message });
      }
    }
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'BULK_IMPORT_SERVICES',
        module: 'Pricing',
        details: `Bulk import: ${results.created} created, ${results.updated} updated`
      }
    });
    res.json({ message: 'Bulk import completed', ...results });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SERVICE CONFIGURATION
// ============================================================
app.get('/api/services/config', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const configs = await req.db.serviceConfiguration.findMany({ orderBy: { serviceType: 'asc' } });
    res.json(configs);
  } catch (error) {
    console.error('Get service configs error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/services/config/:serviceType', async (req, res) => {
  try {
    const { serviceType } = req.params;
    const { tenantId } = req.query;

    // If the caller has a valid token, use the tenant-scoped client.
    // Otherwise (kiosk mode), fall back to the unscoped client with
    // an explicit tenantId query parameter.
    let config = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Staff request — verify token and use tenant-scoped client
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const scopedTenantId = decoded.tenantId;
        if (!scopedTenantId) {
          return res.status(401).json({ error: 'Token missing tenant context' });
        }
        const db = getTenantPrisma(scopedTenantId);
        config = await db.serviceConfiguration.findFirst({ where: { serviceType } });
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    } else if (tenantId) {
      // Kiosk / public request — use unscoped client with explicit tenantId
      config = await prisma.serviceConfiguration.findFirst({
        where: { serviceType, tenantId }
      });
    } else {
      return res.status(400).json({
        error: 'tenantId query parameter is required for unauthenticated requests'
      });
    }

    // Fall back to defaults if no config row exists
    if (!config) {
      const defaults = {
        REGISTRATION: { baseAmount: 2000, name: 'Registration Fee' },
        CARD: { baseAmount: 1000, name: 'Hospital ID Card' },
        CONSULTATION: { baseAmount: 5000, name: 'Consultation Fee' }
      };
      return res.json({
        serviceType,
        name: defaults[serviceType]?.name || serviceType,
        baseAmount: defaults[serviceType]?.baseAmount || 3000,
        isActive: true
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Get service config error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/config/:serviceType', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { serviceType } = req.params;
    const { name, description, baseAmount, nhisAmount, corporateAmount, isActive } = req.body;
    const config = await req.db.serviceConfiguration.upsert({
      where: { serviceType },
      update: {
        name: name || undefined,
        description: description || undefined,
        baseAmount: baseAmount !== undefined ? parseFloat(baseAmount) : undefined,
        nhisAmount: nhisAmount !== undefined ? parseFloat(nhisAmount) : undefined,
        corporateAmount: corporateAmount !== undefined ? parseFloat(corporateAmount) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      create: {
        serviceType,
        name: name || serviceType,
        description: description || null,
        baseAmount: parseFloat(baseAmount) || 0,
        nhisAmount: nhisAmount ? parseFloat(nhisAmount) : null,
        corporateAmount: corporateAmount ? parseFloat(corporateAmount) : null,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_SERVICE_CONFIG',
        module: 'Pricing',
        details: `Updated ${serviceType} fee to ₦${config.baseAmount}`
      }
    });
    res.json(config);
  } catch (error) {
    console.error('Update service config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AVAILABLE DOCTORS
// ============================================================
app.get('/api/doctors/available', authenticate, authorize('Doctor', 'Nurse', 'Records', 'Admin'), async (req, res) => {
  try {
    const doctors = await req.db.staff.findMany({
      where: { role: { in: ['Doctor', 'Obstetrician'] }, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true, email: true },
      orderBy: { firstName: 'asc' }
    });
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AUDIT LOGS
// ============================================================
app.get('/api/audit-logs', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const logs = await req.db.auditLog.findMany({
      include: { Staff: true },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await req.db.auditLog.count();
    res.json({
      data: logs.map(log => ({ ...log, staff: log.Staff })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ADMIN — Service Fees (used by ServiceFeeManager.jsx)
// These are a thin wrapper over ServiceConfiguration.
// ============================================================
app.get('/api/admin/service-fees', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const fees = await req.db.serviceConfiguration.findMany({
      orderBy: { serviceType: 'asc' }
    });
    res.json(fees);
  } catch (error) {
    console.error('Get service fees error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/service-fees', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { serviceType, name, description, baseAmount, isActive } = req.body;

    if (!serviceType || !name || baseAmount === undefined) {
      return res.status(400).json({ error: 'serviceType, name, and baseAmount are required' });
    }

    const normalizedType = String(serviceType).toUpperCase().trim();

    // Guard against duplicate service types (schema has @@unique([tenantId, serviceType]))
    const existing = await req.db.serviceConfiguration.findFirst({
      where: { serviceType: normalizedType }
    });
    if (existing) {
      return res.status(400).json({ error: `A service fee with type "${normalizedType}" already exists. Use PUT to update it.` });
    }

    const fee = await req.db.serviceConfiguration.create({
      data: {
        serviceType: normalizedType,
        name: name.trim(),
        description: description || null,
        baseAmount: parseFloat(baseAmount) || 0,
        isActive: isActive !== false
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_SERVICE_FEE',
        module: 'Pricing',
        details: `Created service fee ${normalizedType} (${name}) at ₦${baseAmount}`
      }
    });

    res.status(201).json(fee);
  } catch (error) {
    console.error('Create service fee error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Service fee already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/admin/service-fees/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, baseAmount, isActive } = req.body;

    const existing = await req.db.serviceConfiguration.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Service fee not found' });

    const fee = await req.db.serviceConfiguration.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        baseAmount: baseAmount !== undefined ? (parseFloat(baseAmount) || 0) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date()
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_SERVICE_FEE',
        module: 'Pricing',
        details: `Updated service fee ${fee.serviceType} (${fee.name}) to ₦${fee.baseAmount}${isActive === false ? ' [inactive]' : ''}`
      }
    });

    res.json(fee);
  } catch (error) {
    console.error('Update service fee error:', error);
    res.status(400).json({ error: error.message });
  }
});


// ============================================================
// ADMIN — Delete service fee
//
// Three-tier behavior:
//   1. Unknown service types (LAB_FEE, XRAY_FEE, etc.) → hard delete
//   2. Known system types (REGISTRATION, CARD, CONSULTATION) → blocked
//      unless ?force=true is passed
//   3. Every delete (or forced delete) is audit-logged with the
//      full row snapshot so it can be restored manually if needed
// ============================================================
app.delete('/api/admin/service-fees/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    const force = String(req.query.force).toLowerCase() === 'true';

    // System types that billing/kiosk/intake look up by type name.
    // Deleting these without force=true is almost always a mistake —
    // the safer action is to deactivate them via PUT isActive=false.
    const PROTECTED_TYPES = ['REGISTRATION', 'CARD', 'CONSULTATION'];

    const existing = await req.db.serviceConfiguration.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Service fee not found' });
    }

    // Guard: protected type
    if (PROTECTED_TYPES.includes(existing.serviceType) && !force) {
      return res.status(409).json({
        error:
          `"${existing.serviceType}" is a system service fee that other parts of the app ` +
          `(kiosk check-in, patient intake, billing) look up by name. Deleting it will ` +
          `fall back to hardcoded defaults, silently changing how much you charge.`,
        hint:
          `Deactivate it instead (PUT with isActive=false), or resend the DELETE with ` +
          `?force=true to override.`,
        serviceType: existing.serviceType,
        protectedTypes: PROTECTED_TYPES,
        forceable: true
      });
    }

    // Snapshot BEFORE deleting — audit log FK requires a real Staff row,
    // so we log the snapshot with the full row for manual recovery.
    const snapshot = {
      id: existing.id,
      serviceType: existing.serviceType,
      name: existing.name,
      description: existing.description,
      baseAmount: existing.baseAmount,
      nhisAmount: existing.nhisAmount,
      corporateAmount: existing.corporateAmount,
      isActive: existing.isActive,
      createdAt: existing.createdAt,
      deletedAt: new Date().toISOString(),
      deletedBy: req.user.id,
      deletedByRole: req.user.role,
      forced: force
    };

    await req.db.serviceConfiguration.delete({ where: { id } });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: force ? 'FORCE_DELETE_SERVICE_FEE' : 'DELETE_SERVICE_FEE',
        module: 'Pricing',
        details: JSON.stringify(snapshot)
      }
    });

    const affectedDefaults = PROTECTED_TYPES.includes(existing.serviceType)
      ? {
          warning:
            `This was a system-protected type. Kiosk check-in, patient intake, and ` +
            `billing will now fall back to the hardcoded default amount until a new ` +
            `"${existing.serviceType}" configuration is created.`,
          fallbackDefaults: {
            REGISTRATION: 2000,
            CARD: 1000,
            CONSULTATION: 5000
          }
        }
      : null;

    res.json({
      success: true,
      message: `Service fee "${existing.name}" (${existing.serviceType}) deleted successfully`,
      deleted: {
        id: existing.id,
        serviceType: existing.serviceType,
        name: existing.name,
        baseAmount: existing.baseAmount,
        forced: force
      },
      ...(affectedDefaults ? { _meta: affectedDefaults } : {})
    });
  } catch (error) {
    console.error('Delete service fee error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Service fee not found' });
    }
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// SYSTEM STATUS
// ============================================================
app.get('/api/system/status', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    res.json({
      status: 'online',
      database: 'connected',
      uptime,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
      },
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/logs', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const logs = await req.db.auditLog.findMany({
      include: {
        Staff: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await req.db.auditLog.count();
    res.json({
      data: logs.map(log => ({ ...log, staff: log.Staff })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// WARDS
// ============================================================
app.get('/api/wards', authenticate, async (req, res) => {
  try {
    const wards = await req.db.ward.findMany({ orderBy: { name: 'asc' } });
    res.json(wards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wards', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { name, description, capacity } = req.body;
    if (!name) return res.status(400).json({ error: 'Ward name is required' });
    const ward = await req.db.ward.create({
      data: {
        name: name.trim(),
        description: description || null,
        capacity: capacity ? parseInt(capacity) : null,
        updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_WARD',
        module: 'Admin',
        details: `Created ward: ${name}`
      }
    });
    res.status(201).json(ward);
  } catch (error) {
    console.error('Create ward error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/wards/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, capacity } = req.body;
    if (!name) return res.status(400).json({ error: 'Ward name is required' });
    const existingWard = await req.db.ward.findUnique({ where: { id } });
    if (!existingWard) return res.status(404).json({ error: 'Ward not found' });
    const updatedWard = await req.db.ward.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description || null,
        capacity: capacity ? parseInt(capacity) : null,
        updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_WARD',
        module: 'Admin',
        details: `Updated ward: ${name}`
      }
    });
    res.json(updatedWard);
  } catch (error) {
    console.error('Update ward error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/wards/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const ward = await req.db.ward.findUnique({ where: { id } });
    if (!ward) return res.status(404).json({ error: 'Ward not found' });

    const activeAdmissions = await req.db.admission.count({ where: { wardId: id, status: 'Admitted' } });
    if (activeAdmissions > 0) {
      return res.status(400).json({
        error: `Cannot delete ward "${ward.name}". There are ${activeAdmissions} active patients admitted to this ward.`
      });
    }
    const activeJourneys = await req.db.patientJourney.count({
      where: { wardId: id, status: { notIn: ['COMPLETED'] } }
    });
    if (activeJourneys > 0) {
      return res.status(400).json({
        error: `Cannot delete ward "${ward.name}". There are ${activeJourneys} active patients assigned to this ward.`
      });
    }

    await req.db.$transaction(async (tx) => {
      await tx.staffWard.deleteMany({ where: { wardId: id } });
      await tx.patientQueue.deleteMany({ where: { wardId: id } });
      await tx.patientTransfer.deleteMany({ where: { OR: [{ fromWardId: id }, { toWardId: id }] } });
      await tx.ward.delete({ where: { id } });
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_WARD',
        module: 'Admin',
        details: `Deleted ward: ${ward.name} (${id})`
      }
    });
    res.json({ message: 'Ward deleted successfully', ward: { id, name: ward.name } });
  } catch (error) {
    console.error('Delete ward error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete ward.' });
  }
});

// ============================================================
// CLINICS
// ============================================================
app.get('/api/clinics', authenticate, async (req, res) => {
  try {
    const clinics = await req.db.clinic.findMany({ orderBy: { name: 'asc' } });
    res.json(clinics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clinics', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { name, description, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Clinic name is required' });
    const clinic = await req.db.clinic.create({ data: { name, description, location } });
    res.status(201).json(clinic);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/clinics/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Clinic name is required' });
    const existingClinic = await req.db.clinic.findUnique({ where: { id } });
    if (!existingClinic) return res.status(404).json({ error: 'Clinic not found' });
    const duplicateName = await req.db.clinic.findFirst({ where: { name, NOT: { id } } });
    if (duplicateName) return res.status(400).json({ error: 'A clinic with this name already exists' });

    const updatedClinic = await req.db.clinic.update({
      where: { id },
      data: { name, description: description || null, location: location || null }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_CLINIC',
        module: 'Admin',
        details: `Updated clinic: ${name} (${id})`
      }
    });
    res.json(updatedClinic);
  } catch (error) {
    console.error('Update clinic error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/clinics/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const clinic = await req.db.clinic.findUnique({ where: { id } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    const activeJourneys = await req.db.patientJourney.count({
      where: { clinicId: id, status: { notIn: ['COMPLETED'] } }
    });
    if (activeJourneys > 0) {
      return res.status(400).json({
        error: `Cannot delete clinic "${clinic.name}". There are ${activeJourneys} active patients assigned to this clinic.`
      });
    }

    await req.db.$transaction(async (tx) => {
      await tx.staffClinic.deleteMany({ where: { clinicId: id } });
      await tx.servicePrice.deleteMany({ where: { clinicId: id } });
      await tx.patientQueue.deleteMany({ where: { clinicId: id } });
      await tx.patientTransfer.deleteMany({ where: { OR: [{ fromClinicId: id }, { toClinicId: id }] } });
      await tx.clinic.delete({ where: { id } });
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_CLINIC',
        module: 'Admin',
        details: `Deleted clinic: ${clinic.name} (${id})`
      }
    });
    res.json({ message: 'Clinic deleted successfully', clinic: { id, name: clinic.name } });
  } catch (error) {
    console.error('Delete clinic error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete clinic.' });
  }
});

// ============================================================
// PATIENT JOURNEYS
// ============================================================
app.get('/api/patient-journeys', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const journeys = await req.db.patientJourney.findMany({
      include: {
        Patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true,
            gender: true, dateOfBirth: true, isArchived: true,
            patientCategory: true, insuranceProvider: true,
            insuranceId: true, corporateCompany: true
          }
        },
        Clinic: true,
        Ward: true,
        Staff: { select: { id: true, firstName: true, lastName: true } },
        BillingRecord: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(journeys.map(j => ({
      ...j,
      patient: j.Patient,
      registeredBy: j.Staff,
      billingRecord: j.BillingRecord,
      clinic: j.Clinic,
      ward: j.Ward
    })));
  } catch (error) {
    console.error('Get journeys error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient-journeys', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { patientId: hospitalIdInput, destinationType, clinicId, wardId } = req.body;
    if (!hospitalIdInput || !destinationType) {
      return res.status(400).json({ error: 'Patient and Destination Type are required' });
    }
    const patient = await req.db.patient.findFirst({ where: { hospitalId: hospitalIdInput } });
    if (!patient) return res.status(404).json({ error: 'Patient not found. Please check the Hospital ID.' });
    if (destinationType === 'CLINIC' && !clinicId) {
      return res.status(400).json({ error: 'A Clinic must be selected for outpatient visits' });
    }
    if (destinationType === 'WARD' && !wardId) {
      return res.status(400).json({ error: 'A Ward must be selected for inpatient admissions' });
    }
    const existing = await req.db.patientJourney.findFirst({
      where: { patientId: patient.id, status: { not: 'COMPLETED' } }
    });
    if (existing) return res.status(400).json({ error: 'Patient already has an active intake process.' });

    const journey = await req.db.patientJourney.create({
      data: {
        patientId: patient.id,
        destinationType,
        clinicId: destinationType === 'CLINIC' ? clinicId : null,
        wardId: destinationType === 'WARD' ? wardId : null,
        registeredById: req.user.id,
        status: 'REGISTERED', updatedAt: new Date()
      },
      include: { Patient: true, Clinic: true, Ward: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'START_INTAKE',
        module: 'Records',
        details: `Started intake for ${patient.hospitalId}`
      }
    });
    res.status(201).json({ ...journey, patient: journey.Patient, clinic: journey.Clinic, ward: journey.Ward });
  } catch (error) {
    console.error('Error in create journey:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/patient-journeys/:id/status', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id) return res.status(400).json({ error: 'Journey ID is required' });
    const validStatuses = ['PENDING_BILLING', 'BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION', 'COMPLETED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` });
    }
    const existingJourney = await req.db.patientJourney.findUnique({
      where: { id },
      include: { Patient: true, Clinic: true, Ward: true, BillingRecord: true }
    });
    if (!existingJourney) return res.status(404).json({ error: 'Journey not found' });

    if (status === 'PENDING_BILLING') {
      const hasDestination = existingJourney.destinationType === 'CLINIC'
        ? existingJourney.clinicId
        : existingJourney.destinationType === 'WARD'
          ? existingJourney.wardId
          : false;
      if (!hasDestination) {
        return res.status(400).json({
          error: 'Please set a Clinic or Ward destination before sending to billing.',
          code: 'NO_DESTINATION'
        });
      }
    }

    const updateData = { status, updatedAt: new Date() };
    if (status === 'CARD_PRINTED') updateData.cardGeneratedAt = new Date();
    if (status === 'SENT_TO_DESTINATION') updateData.sentToDestinationAt = new Date();

    if (status === 'PENDING_BILLING') {
      let bill = existingJourney.BillingRecord;
      if (!bill) {
        const patient = existingJourney.Patient;
        if (!patient) return res.status(404).json({ error: 'Patient not found for this journey' });

        const price = await req.db.servicePrice.findFirst({
          where: { OR: [{ clinicId: existingJourney.Clinic?.id }, { name: 'Consultation' }], isActive: true }
        });
        const baseAmount = price ? price.amount : 5000;
        const category = patient.patientCategory || 'FPP';
        let finalAmount = baseAmount;
        let categoryLabel = '';
        if (category === 'NHIS') { finalAmount = Math.round(baseAmount * 0.1); categoryLabel = 'NHIS - 10%'; }
        else if (category === 'CORPORATE') { finalAmount = baseAmount * 2; categoryLabel = 'CORPORATE - 200%'; }
        else { categoryLabel = 'FPP - 100%'; }

        const description = price ? price.name : 'General Consultation';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const invoiceNumber = `INV-${new Date().getFullYear()}-${timestamp}-${random}`;
        const billingItems = [{
          name: 'Consultation Fee',
          category: 'Consultation',
          amount: finalAmount, status: 'Pending',
          serviceType: 'CONSULTATION',
          description: `${description} (${categoryLabel})`
        }];
        bill = await req.db.billingRecord.create({
          data: {
            patientId: patient.id,
            invoiceNumber,
            description: `${description} (${categoryLabel} - ₦${finalAmount})`,
            totalAmount: finalAmount,
            status: 'Pending',
            items: billingItems,
            balance: finalAmount,
            paidAmount: 0,
            updatedAt: new Date()
          }
        });
        updateData.billingRecordId = bill.id;
      }
    }

    const journey = await req.db.patientJourney.update({
      where: { id },
      data: updateData,
      include: { Patient: true, Clinic: true, Ward: true, BillingRecord: true }
    });

    if (status === 'SENT_TO_DESTINATION' && journey.destinationType === 'WARD') {
      const existingAdmission = await req.db.admission.findFirst({
        where: { patientId: journey.Patient?.id, status: 'Admitted' }
      });
      if (!existingAdmission && journey.Ward) {
        const count = await req.db.admission.count();
        const admissionNumber = `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        await req.db.admission.create({
          data: {
            admissionNumber,
            patientId: journey.Patient?.id,
            wardId: journey.Ward.id,
            staffId: req.user.id,
            status: 'Admitted',
            notes: 'Admitted via Patient Intake.',
            updatedAt: new Date()
          }
        });
      }
    }

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_INTAKE_STATUS',
        module: 'Records',
        details: `Patient ${journey.Patient?.hospitalId} moved to ${status}`
      }
    });
    res.json({
      ...journey,
      patient: journey.Patient,
      clinic: journey.Clinic,
      ward: journey.Ward,
      billingRecord: journey.BillingRecord
    });
  } catch (error) {
    console.error('Error updating journey status:', error);
    res.status(500).json({ error: error.message || 'Failed to update journey status' });
  }
});

app.patch('/api/patient-journeys/:id', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { destinationType, clinicId, wardId } = req.body;

    const existingJourney = await req.db.patientJourney.findUnique({
      where: { id },
      include: { Patient: true, Clinic: true, Ward: true }
    });
    if (!existingJourney) return res.status(404).json({ error: 'Journey not found' });

    const updateData = { updatedAt: new Date() };
    if (destinationType) updateData.destinationType = destinationType;
    if (destinationType === 'CLINIC') {
      updateData.clinicId = clinicId || null;
      updateData.wardId = null;
    } else if (destinationType === 'WARD') {
      updateData.wardId = wardId || null;
      updateData.clinicId = null;
    } else {
      if (clinicId !== undefined) updateData.clinicId = clinicId;
      if (wardId !== undefined) updateData.wardId = wardId;
    }

    // ✅ THE MISSING UPDATE CALL
    const updatedJourney = await req.db.patientJourney.update({
      where: { id },
      data: updateData,
      include: { Patient: true, Clinic: true, Ward: true, BillingRecord: true }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_JOURNEY_DESTINATION',
        module: 'Records',
        details: `Updated destination for patient ${updatedJourney.Patient?.hospitalId || 'N/A'} to ${destinationType || 'updated'}`
      }
    });

    res.json({
      ...updatedJourney,
      patient: updatedJourney.Patient,
      clinic: updatedJourney.Clinic,
      ward: updatedJourney.Ward,
      billingRecord: updatedJourney.BillingRecord
    });
  } catch (error) {
    console.error('Error updating journey:', error);
    res.status(500).json({ error: error.message || 'Failed to update journey' });
  }
});

// ============================================================
// REVERSE A JOURNEY
// ============================================================
app.patch('/api/patient-journeys/:id/reverse', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const journey = await req.db.patientJourney.findUnique({
      where: { id },
      include: { Patient: true, BillingRecord: true }
    });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });
    if (!['COMPLETED', 'SENT_TO_DESTINATION'].includes(journey.status)) {
      return res.status(400).json({ error: 'Only COMPLETED or SENT_TO_DESTINATION journeys can be reversed' });
    }

    // If a bill exists, snapshot → mark original txn reversed → refund → reset items
    if (journey.billingRecordId && journey.BillingRecord) {
      const bill = journey.BillingRecord;
      const amountPaid = bill.paidAmount || 0;

      // ── 1) Snapshot the bill's pre-reversal state into the audit trail ──
      //      BEFORE anything is modified, so history is preserved forever.
      await req.db.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'BILL_REVERSED',
          module: 'Billing',
          details: JSON.stringify({
            invoiceNumber: bill.invoiceNumber,
            priorStatus: bill.status,
            priorPaidAmount: bill.paidAmount,
            priorPaymentMethod: bill.paymentMethod,
            priorItems: Array.isArray(bill.items) ? bill.items.map(i => ({
              name: i.name,
              category: i.category,
              amount: i.amount,
              status: i.status,
              paidAmount: i.paidAmount,
              serviceType: i.serviceType,
            })) : bill.items,
            priorWalletTransactionId: bill.walletTransactionId,
            reversalReason: reason || 'Process correction',
            reversedBy: req.user.id,
            reversedAt: new Date().toISOString(),
          })
        }
      });

      // ── 2) Mark the original wallet transaction as Reversed ──
      //      This must happen BEFORE the bill loses its walletTransactionId reference.
      if (bill.isWalletPayment && bill.walletTransactionId) {
        try {
          await req.db.walletTransaction.update({
            where: { id: bill.walletTransactionId },
            data: {
              status: 'Reversed',
              notes: `Reversed due to journey reversal on ${new Date().toISOString()}. Reason: ${reason || 'Process correction'}`,
              updatedAt: new Date()
            }
          });
        } catch (err) {
          console.warn('Could not mark original transaction as reversed:', err.message);
        }
      }

      // ── 3) Refund wallet if the payment was made from wallet ──
      if (bill.isWalletPayment && amountPaid > 0) {
        const wallet = await req.db.patientWallet.findUnique({
          where: { patientId: journey.patientId }
        });
        if (wallet) {
          const balanceBefore = wallet.balance;
          const balanceAfter = balanceBefore + amountPaid;
          await req.db.$transaction(async (tx) => {
            await tx.patientWallet.update({
              where: { id: wallet.id },
              data: {
                balance: balanceAfter,
                lastTransactionAt: new Date(),
                updatedAt: new Date()
              }
            });
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                transactionType: 'Refund',
                amount: amountPaid,
                balanceBefore,
                balanceAfter,
                description: `Reversal refund for ${bill.invoiceNumber}`,
                reference: `REV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                status: 'Completed',
                category: 'Billing',
                serviceId: bill.id,
                serviceType: 'billing_reversal',
                notes: `Auto-refund on journey reversal. Reason: ${reason || 'Process correction'}`,
                updatedAt: new Date()
              }
            });
            await tx.patient_notifications.create({
              data: {
                patientId: journey.patientId,
                title: '💰 Wallet Refund',
                message: `₦${amountPaid.toLocaleString()} has been refunded to your wallet for invoice ${bill.invoiceNumber}.`,
                type: 'wallet'
              }
            });
          });
        }
      }

      // ── 4) Reset every bill item back to Pending ──
      const originalItems = Array.isArray(bill.items) ? bill.items : [];
      const resetItems = originalItems.map(item => ({
        ...item,
        status: 'Pending',
        paidAt: null,
        paidAmount: 0
      }));

      // ── 5) Reset the bill itself ──
      //      Note: we do NOT set billingRecordId to null on the journey,
      //      so the same bill keeps its full original set of items
      //      (Registration + Card + Consultation) instead of getting
      //      regenerated with just a single Consultation item.
      await req.db.billingRecord.update({
        where: { id: journey.billingRecordId },
        data: {
          status: 'Pending',
          paidAmount: 0,
          balance: bill.totalAmount,
          items: resetItems,
          paymentMethod: null,
          paymentDate: null,
          isWalletPayment: false,
          walletTransactionId: null,
          walletAmountPaid: null,
          cashAmountPaid: null,
          paymentReference: null,
          processedBy: null,
          processedAt: null,
          receiptGenerated: false,
          receiptGeneratedAt: null,
          receiptNumber: null,
          updatedAt: new Date()
        }
      });
    }

    // ── 6) Reverse the journey itself ──
    //      We keep billingRecordId intact so the same bill is reused.
    const updatedJourney = await req.db.patientJourney.update({
      where: { id },
      data: {
        status: 'SENT_TO_DESTINATION',
        sentToDestinationAt: null,
        cardGeneratedAt: null,
        registrationFeePaid: false,
        cardFeePaid: false,
        consultationFeePaid: false,
        updatedAt: new Date()
      },
      include: { Patient: true, Clinic: true, Ward: true, BillingRecord: true }
    });

    // ── 7) If admitted to a ward, discharge ──
    if (journey.wardId) {
      const admission = await req.db.admission.findFirst({
        where: { patientId: journey.patientId, status: 'Admitted' }
      });
      if (admission) {
        await req.db.admission.update({
          where: { id: admission.id },
          data: {
            status: 'Discharged',
            dischargeDate: new Date(),
            notes: `Discharged due to journey reversal: ${reason || 'Process error'}`,
            updatedAt: new Date()
          }
        });
      }
    }

    // ── 8) Journey-level audit entry ──
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'REVERSE_JOURNEY',
        module: 'Records',
        details:
          `Reversed journey for ${journey.Patient?.hospitalId}. ` +
          `Bill ${journey.BillingRecord?.invoiceNumber || 'N/A'} reset to Pending. ` +
          `Reason: ${reason || 'Process error'}`
      }
    });

    res.json({
      message: 'Journey reversed successfully',
      journey: {
        ...updatedJourney,
        patient: updatedJourney.Patient,
        clinic: updatedJourney.Clinic,
        ward: updatedJourney.Ward,
        billingRecord: updatedJourney.BillingRecord
      }
    });
  } catch (error) {
    console.error('Reverse journey error:', error);
    res.status(400).json({ error: error.message || 'Failed to reverse journey' });
  }
});

app.get('/api/billing/:id/reversals', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await req.db.billingRecord.findUnique({
      where: { id },
      select: { invoiceNumber: true }
    });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // Find all BILL_REVERSED audit entries that mention this invoice number
    const entries = await req.db.auditLog.findMany({
      where: {
        action: 'BILL_REVERSED',
        module: 'Billing',
        details: { contains: bill.invoiceNumber }
      },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, username: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json(entries.map(e => ({
      id: e.id,
      createdAt: e.createdAt,
      staff: e.Staff,
      snapshot: (() => { try { return JSON.parse(e.details); } catch { return null; } })()
    })));
  } catch (error) {
    console.error('Get bill reversals error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient-journeys/:id/reprint-card', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const journey = await req.db.patientJourney.findUnique({
      where: { id },
      include: { Patient: true }
    });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });
    if (!journey.cardGeneratedAt) {
      return res.status(400).json({ error: 'Card has not been printed yet. Please mark as CARD_PRINTED first.' });
    }
    const updatedJourney = await req.db.patientJourney.update({
      where: { id },
      data: { cardGeneratedAt: new Date(), updatedAt: new Date() },
      include: { Patient: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'REPRINT_CARD',
        module: 'Records',
        details: `Reprinted card for patient ${journey.Patient?.hospitalId}`
      }
    });
    res.json({
      message: 'Card reprint recorded successfully',
      journey: { ...updatedJourney, patient: updatedJourney.Patient },
      patient: updatedJourney.Patient
    });
  } catch (error) {
    console.error('Reprint card error:', error);
    res.status(400).json({ error: error.message || 'Failed to reprint card' });
  }
});

app.patch('/api/patient-journeys/:id/return-to-stage', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { targetStatus, reason } = req.body;
    const validStatuses = ['REGISTERED', 'PENDING_BILLING', 'BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION'];
    if (!targetStatus || !validStatuses.includes(targetStatus)) {
      return res.status(400).json({ error: `Invalid target status. Valid: ${validStatuses.join(', ')}` });
    }
    const journey = await req.db.patientJourney.findUnique({
      where: { id },
      include: { Patient: true, BillingRecord: true }
    });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });

    const statusOrder = ['REGISTERED', 'PENDING_BILLING', 'BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(journey.status);
    const targetIndex = statusOrder.indexOf(targetStatus);
    if (targetIndex >= currentIndex) {
      return res.status(400).json({ error: 'Can only return to a previous stage (not forward)' });
    }

    const updateData = { status: targetStatus, updatedAt: new Date() };
    if (targetStatus === 'REGISTERED') {
      updateData.cardGeneratedAt = null;
      updateData.sentToDestinationAt = null;
      updateData.billingRecordId = null;
    } else if (targetStatus === 'PENDING_BILLING' || targetStatus === 'BILLING_CLEARED') {
      updateData.cardGeneratedAt = null;
      updateData.sentToDestinationAt = null;
    } else if (targetStatus === 'CARD_PRINTED') {
      updateData.sentToDestinationAt = null;
    }

    const updatedJourney = await req.db.patientJourney.update({
      where: { id },
      data: updateData,
      include: { Patient: true, Clinic: true, Ward: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'RETURN_TO_STAGE',
        module: 'Records',
        details: `Returned patient ${journey.Patient?.hospitalId} to ${targetStatus}. Reason: ${reason || 'Process correction'}`
      }
    });
    res.json({
      message: `Patient returned to ${targetStatus} successfully`,
      journey: {
        ...updatedJourney,
        patient: updatedJourney.Patient,
        clinic: updatedJourney.Clinic,
        ward: updatedJourney.Ward
      }
    });
  } catch (error) {
    console.error('Return to stage error:', error);
    res.status(400).json({ error: error.message || 'Failed to return to stage' });
  }
});

// ============================================================
// ADT (ADMISSIONS, DISCHARGES, TRANSFERS)
// ============================================================
app.get('/api/admissions', authenticate, async (req, res) => {
  try {
    const admissions = await req.db.admission.findMany({
      include: {
        Patient: { select: { firstName: true, lastName: true, hospitalId: true, id: true, phone: true, gender: true, dateOfBirth: true } },
        Staff: { select: { firstName: true, lastName: true, role: true, id: true } },
        Ward: true
      },
      orderBy: { admissionDate: 'desc' }
    });
    res.json(admissions.map(a => ({ ...a, patient: a.Patient, staff: a.Staff, ward: a.Ward })));
  } catch (error) {
    console.error('Get admissions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admissions', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { patientId, staffId, wardId, notes } = req.body;
    if (!patientId || !staffId || !wardId) {
      return res.status(400).json({ error: 'Missing required fields: patientId, staffId, wardId' });
    }
    const count = await req.db.admission.count();
    const admissionNumber = `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const admission = await req.db.admission.create({
      data: { admissionNumber, patientId, staffId, wardId, notes, status: 'Admitted' },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        Staff: { select: { id: true, firstName: true, lastName: true, role: true } },
        Ward: true
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'ADMIT_PATIENT',
        module: 'Records',
        details: `Admitted patient ${admission.Patient.hospitalId} (${admissionNumber}) to ${admission.Ward?.name || 'N/A'}`
      }
    });
    res.status(201).json({ ...admission, patient: admission.Patient, staff: admission.Staff, ward: admission.Ward });
  } catch (error) {
    console.error('Create admission error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admissions/:id/discharge', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const admission = await req.db.admission.update({
      where: { id },
      data: { status: 'Discharged', dischargeDate: new Date(), notes: notes || undefined },
      include: { Patient: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DISCHARGE_PATIENT',
        module: 'Records',
        details: `Discharged patient ${admission.Patient.hospitalId}`
      }
    });
    res.json({ ...admission, patient: admission.Patient });
  } catch (error) {
    console.error('Discharge error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admissions/:id/transfer', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { wardId, notes } = req.body;
    if (!wardId) return res.status(400).json({ error: 'New wardId is required' });
    const admission = await req.db.admission.update({
      where: { id },
      data: { wardId, notes: notes || undefined },
      include: { Patient: true, Ward: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'TRANSFER_PATIENT',
        module: 'Records',
        details: `Transferred patient ${admission.Patient.hospitalId} to ${admission.Ward.name}`
      }
    });
    res.json({ ...admission, patient: admission.Patient, ward: admission.Ward });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// VITALS
// ============================================================
app.get('/api/patients/:patientId/vitals', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const vitals = await req.db.vitalSign.findMany({
      where: { patientId },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { recordedAt: 'desc' }
    });
    res.json(vitals.map(v => ({
      ...v,
      nurse: v.Staff
        ? { ...v.Staff, fullName: v.Staff.firstName && v.Staff.lastName
            ? `${v.Staff.firstName} ${v.Staff.lastName}`
            : `${v.Staff.role || 'Unknown'} (ID: ${v.nurseId?.slice(0, 8) || 'Unknown'})` }
        : { fullName: 'Unknown Nurse (Deleted)', role: 'Unknown' }
    })));
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vitals', authenticate, authorize('Nurse', 'Midwife', 'Doctor', 'Obstetrician', 'Admin', 'Paediatrician'), async (req, res) => {
  try {
    const {
      patientId, bloodPressureSystolic, bloodPressureDiastolic, heartRate,
      temperature, respiratoryRate, oxygenSaturation, weight, height, notes
    } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });

    const vital = await req.db.vitalSign.create({
      data: {
        patientId, nurseId: req.user.id,
        bloodPressureSystolic: bloodPressureSystolic ? parseInt(bloodPressureSystolic) : null,
        bloodPressureDiastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : null,
        oxygenSaturation: oxygenSaturation ? parseInt(oxygenSaturation) : null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        notes: notes || null, updatedAt: new Date()
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'RECORD_VITALS',
        module: 'Nursing',
        details: `Recorded vitals for patient ${patientId}`
      }
    });
    res.status(201).json(vital);
  } catch (error) {
    console.error('Error recording vitals:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ANTENATAL
// ============================================================
app.get('/api/pregnancies/:id', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { id } = req.params;
    const pregnancy = await req.db.pregnancy.findUnique({
      where: { id },
      include: {
        Patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true,
            gender: true, dateOfBirth: true, phone: true, email: true
          }
        },
        AntenatalVisit: {
          include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
          orderBy: { visitDate: 'desc' }
        },
        Delivery: {
          include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
        }
      }
    });
    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found' });
    res.json({
      ...pregnancy,
      patient: pregnancy.Patient,
      visits: pregnancy.AntenatalVisit || [],
      delivery: pregnancy.Delivery
    });
  } catch (error) {
    console.error('Get pregnancy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pregnancies', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const role = req.user.role;
    let where = {};
    if (['Nurse', 'Midwife'].includes(role)) {
      const staff = await req.db.staff.findUnique({
        where: { id: req.user.id },
        include: {
          StaffClinic: { select: { clinicId: true } },
          StaffWard: { select: { wardId: true } }
        }
      });
      const clinicIds = staff?.StaffClinic?.map(c => c.clinicId) || [];
      const wardIds = staff?.StaffWard?.map(w => w.wardId) || [];
      if (clinicIds.length === 0 && wardIds.length === 0) return res.json([]);

      const patientJourneys = await req.db.patientJourney.findMany({
        where: {
          status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
          OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
        },
        select: { patientId: true }
      });
      const patientIds = patientJourneys.map(j => j.patientId);
      if (patientIds.length === 0) return res.json([]);
      where = { patientId: { in: patientIds } };
    }

    const pregnancies = await req.db.pregnancy.findMany({
      where,
      include: {
        Patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true,
            gender: true, dateOfBirth: true, phone: true, email: true
          }
        },
        AntenatalVisit: {
          orderBy: { visitDate: 'desc' }, take: 1,
          select: {
            id: true, visitDate: true, gestationalWeeks: true,
            bloodPressure: true, heartRate: true, weight: true,
            fundalHeight: true, notes: true
          }
        },
        Delivery: {
          select: {
            id: true, deliveryDate: true, type: true,
            babyGender: true, babyWeight: true,
            babyApgar1min: true, babyApgar5min: true, babyApgar10min: true,
            babyLength: true, babyHeadCircumference: true,
            maternalCondition: true, outcome: true, notes: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(pregnancies.map(p => ({
      ...p,
      patient: p.Patient,
      visits: p.AntenatalVisit || [],
      delivery: p.Delivery
    })));
  } catch (error) {
    console.error('Get pregnancies error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pregnancies' });
  }
});

app.post('/api/pregnancies', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { patientId, expectedDelivery, gravida, para, lastMenstrualPeriod, estimatedDueDate, riskLevel, notes } = req.body;
    if (!patientId || !expectedDelivery) {
      return res.status(400).json({ error: 'Patient and expected delivery date are required.' });
    }
    const patient = await req.db.patient.findFirst({ where: { hospitalId: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found. Please register the patient first.' });

    const existingPregnancy = await req.db.pregnancy.findFirst({
      where: { patientId: patient.id, status: 'Active' }
    });
    if (existingPregnancy) return res.status(400).json({ error: 'This patient already has an active pregnancy.' });

    const pregnancy = await req.db.pregnancy.create({
      data: {
        patientId: patient.id,
        expectedDelivery: new Date(expectedDelivery),
        gravida: parseInt(gravida) || 0,
        para: parseInt(para) || 0,
        lastMenstrualPeriod: lastMenstrualPeriod ? new Date(lastMenstrualPeriod) : null,
        estimatedDueDate: estimatedDueDate ? new Date(estimatedDueDate) : null,
        riskLevel: riskLevel || 'Low',
        notes: notes || null,
        status: 'Active'
      },
      include: { Patient: true, AntenatalVisit: true, Delivery: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_PREGNANCY',
        module: 'Antenatal',
        details: `Pregnancy record created for patient ${patient.hospitalId}`
      }
    });
    res.status(201).json({
      ...pregnancy,
      patient: pregnancy.Patient,
      visits: pregnancy.AntenatalVisit || [],
      delivery: pregnancy.Delivery
    });
  } catch (error) {
    console.error('Create pregnancy error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/pregnancies/:id', authenticate, checkPermission('antenatal'), async (req, res) => {
  const { id } = req.params;
  const { status, notes, riskLevel, estimatedDueDate, gravida, para } = req.body;
  try {
    const existing = await req.db.pregnancy.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Pregnancy not found' });

    const gravidaValue = gravida !== undefined && gravida !== '' ? parseInt(gravida) : existing.gravida;
    const paraValue = para !== undefined && para !== '' ? parseInt(para) : existing.para;

    const updated = await req.db.pregnancy.update({
      where: { id },
      data: {
        status: status || undefined,
        notes: notes || undefined,
        riskLevel: riskLevel || undefined,
        estimatedDueDate: estimatedDueDate ? new Date(estimatedDueDate) : undefined,
        gravida: gravidaValue,
        para: paraValue
      },
      include: { Patient: true }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_PREGNANCY',
        module: 'Antenatal',
        details: `Updated pregnancy ${id}`
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('PUT /api/pregnancies/:id error:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Pregnancy not found' });
    res.status(500).json({ error: 'Failed to update pregnancy' });
  }
});

app.post('/api/pregnancies/:id/visits', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { id } = req.params;
    const { visitDate, gestationalWeeks, bloodPressure, heartRate, weight, fundalHeight, notes } = req.body;

    const pregnancy = await req.db.pregnancy.findUnique({ where: { id }, select: { id: true } });
    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found' });

    const visit = await req.db.antenatalVisit.create({
      data: {
        pregnancyId: id,
        staffId: req.user.id,
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        gestationalWeeks: parseInt(gestationalWeeks) || null,
        bloodPressure: bloodPressure || null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        weight: weight ? parseFloat(weight) : null,
        fundalHeight: fundalHeight ? parseFloat(fundalHeight) : null,
        notes: notes || null
      },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    await req.db.pregnancy.update({ where: { id }, data: { updatedAt: new Date() } });
    res.status(201).json(visit);
  } catch (error) {
    console.error('Add visit error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// LABOR & DELIVERY
// ============================================================
app.post('/api/pregnancies/:id/start-labor', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { id } = req.params;
    const { laborStartTime, contractions, dilation, effacement, bloodPressure, heartRate, notes } = req.body;

    const pregnancy = await req.db.pregnancy.findUnique({
      where: { id },
      include: { Patient: true, AntenatalVisit: { orderBy: { visitDate: 'desc' }, take: 1 } }
    });
    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found' });
    if (pregnancy.status === 'Delivered') return res.status(400).json({ error: 'This pregnancy has already been delivered' });
    if (pregnancy.status === 'In Labor') return res.status(400).json({ error: 'Patient is already in labor' });

    const updatedPregnancy = await req.db.pregnancy.update({
      where: { id },
      data: {
        status: 'In Labor',
        laborStartTime: laborStartTime ? new Date(laborStartTime) : new Date(),
        contractions: contractions || null,
        dilation: dilation ? parseFloat(dilation) : null,
        effacement: effacement ? parseFloat(effacement) : null,
        laborNotes: notes || null,
        updatedAt: new Date()
      },
      include: { Patient: true, AntenatalVisit: { orderBy: { visitDate: 'desc' }, take: 5 } }
    });

    await req.db.antenatalVisit.create({
      data: {
        pregnancyId: id,
        staffId: req.user.id,
        visitDate: new Date(),
        gestationalWeeks: pregnancy.estimatedDueDate
          ? Math.floor((new Date() - new Date(pregnancy.estimatedDueDate)) / (1000 * 60 * 60 * 24 * 7)) + 40
          : null,
        bloodPressure: bloodPressure || null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        notes: `🟢 LABOR STARTED: ${notes || 'Patient admitted in active labor'}. Contractions: ${contractions || 'Not specified'}. Dilation: ${dilation || 'Not checked'}cm. Effacement: ${effacement || 'Not checked'}%.`
      }
    });

    await req.db.patient_notifications.create({
      data: {
        patientId: pregnancy.patientId,
        title: '🤱 Labor Started',
        message: `Labor has started at ${new Date().toLocaleString()}. Please prepare for delivery.`,
        type: 'labor'
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'START_LABOR',
        module: 'Antenatal',
        details: `Labor started for patient ${pregnancy.Patient?.hospitalId}`
      }
    });

    res.json({
      message: '✅ Labor started successfully!',
      pregnancy: { ...updatedPregnancy, patient: updatedPregnancy.Patient, visits: updatedPregnancy.AntenatalVisit || [] },
      laborStarted: true,
      time: updatedPregnancy.laborStartTime
    });
  } catch (error) {
    console.error('Start labor error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/pregnancies/:id/labor-progress', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { id } = req.params;
    const { contractions, dilation, effacement, fetalHeartRate, maternalHeartRate, bloodPressure, notes } = req.body;

    const pregnancy = await req.db.pregnancy.findUnique({ where: { id }, include: { Patient: true } });
    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found' });
    if (pregnancy.status === 'Delivered') return res.status(400).json({ error: 'This pregnancy has already been delivered' });
    if (pregnancy.status !== 'In Labor') {
      return res.status(400).json({ error: 'Patient is not currently in labor. Please start labor first.' });
    }

    const updatedPregnancy = await req.db.pregnancy.update({
      where: { id },
      data: {
        contractions: contractions || undefined,
        dilation: dilation ? parseFloat(dilation) : undefined,
        effacement: effacement ? parseFloat(effacement) : undefined,
        laborNotes: notes ? `${pregnancy.laborNotes || ''}\n${new Date().toLocaleString()}: ${notes}` : undefined,
        updatedAt: new Date()
      },
      include: { Patient: true }
    });

    await req.db.antenatalVisit.create({
      data: {
        pregnancyId: id,
        staffId: req.user.id,
        visitDate: new Date(),
        gestationalWeeks: null,
        bloodPressure: bloodPressure || null,
        heartRate: maternalHeartRate ? parseInt(maternalHeartRate) : null,
        fetalHeartRate: fetalHeartRate ? parseInt(fetalHeartRate) : null,
        notes: `🟡 LABOR PROGRESS UPDATE: ${notes || 'Progress check'}. Contractions: ${contractions || 'Not specified'}. Dilation: ${dilation || 'Not checked'}cm. Effacement: ${effacement || 'Not checked'}%.`
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_LABOR_PROGRESS',
        module: 'Antenatal',
        details: `Labor progress updated for patient ${pregnancy.Patient?.hospitalId} - Dilation: ${dilation || 'N/A'}cm`
      }
    });

    res.json({
      message: '✅ Labor progress updated successfully!',
      pregnancy: { ...updatedPregnancy, patient: updatedPregnancy.Patient },
      progress: { contractions, dilation, effacement, fetalHeartRate, maternalHeartRate, bloodPressure, notes }
    });
  } catch (error) {
    console.error('Update labor progress error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pregnancies/:id/labor-status', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { id } = req.params;
    const pregnancy = await req.db.pregnancy.findUnique({
      where: { id },
      select: {
        id: true, status: true, laborStartTime: true, contractions: true,
        dilation: true, effacement: true, laborNotes: true, deliveryDate: true,
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        AntenatalVisit: {
          where: {
            OR: [
              { notes: { contains: 'LABOR STARTED' } },
              { notes: { contains: 'LABOR PROGRESS' } }
            ]
          },
          orderBy: { visitDate: 'desc' },
          take: 10,
          include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
        }
      }
    });
    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found' });

    const laborDuration = pregnancy.laborStartTime
      ? Math.floor((new Date() - new Date(pregnancy.laborStartTime)) / (1000 * 60))
      : null;

    res.json({
      pregnancy: { ...pregnancy, patient: pregnancy.Patient },
      isInLabor: pregnancy.status === 'In Labor',
      isDelivered: pregnancy.status === 'Delivered',
      laborStartedAt: pregnancy.laborStartTime,
      laborDurationMinutes: laborDuration,
      laborDurationHours: laborDuration ? Math.floor(laborDuration / 60) : null,
      visits: pregnancy.AntenatalVisit || []
    });
  } catch (error) {
    console.error('Get labor status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// RECORD DELIVERY
// ============================================================
app.post('/api/deliveries', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const {
      pregnancyId, deliveryDate, type, durationHours,
      babyGender, babyWeight, babyLength, babyHeadCircumference,
      babyApgar1min, babyApgar5min, babyApgar10min, babyNotes,
      maternalCondition, complications, placentaDelivery,
      estimatedBloodLoss, perinealCondition, outcome, notes
    } = req.body;

    if (!pregnancyId || !type || !babyGender) {
      return res.status(400).json({ error: 'Pregnancy ID, delivery type, and baby gender are required.' });
    }

    const pregnancy = await req.db.pregnancy.findUnique({
      where: { id: pregnancyId },
      include: { Patient: true }
    });
    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found' });
    if (pregnancy.status === 'Delivered') return res.status(400).json({ error: 'This pregnancy has already been delivered' });

    const mother = pregnancy.Patient;

    const result = await req.db.$transaction(async (tx) => {
      const delivery = await tx.delivery.create({
        data: {
          pregnancyId,
          staffId: req.user.id,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          type,
          durationHours: durationHours ? parseFloat(durationHours) : null,
          babyGender,
          babyWeight: babyWeight ? parseFloat(babyWeight) : null,
          babyLength: babyLength ? parseFloat(babyLength) : null,
          babyHeadCircumference: babyHeadCircumference ? parseFloat(babyHeadCircumference) : null,
          babyApgar1min: babyApgar1min ? parseInt(babyApgar1min) : null,
          babyApgar5min: babyApgar5min ? parseInt(babyApgar5min) : null,
          babyApgar10min: babyApgar10min ? parseInt(babyApgar10min) : null,
          babyNotes: babyNotes || null,
          maternalCondition: maternalCondition || 'Stable',
          complications: complications || null,
          placentaDelivery: placentaDelivery || 'Complete',
          estimatedBloodLoss: estimatedBloodLoss ? parseFloat(estimatedBloodLoss) : null,
          perinealCondition: perinealCondition || 'Intact',
          outcome: outcome || 'Live birth',
          notes: notes || null
        }
      });

      await tx.pregnancy.update({
        where: { id: pregnancyId },
        data: {
          status: 'Delivered',
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          updatedAt: new Date()
        }
      });

      const allPatients = await tx.patient.findMany({
        select: { hospitalId: true },
        orderBy: { hospitalId: 'desc' },
        take: 1
      });

      let maxNumericId = 0;
      for (const p of allPatients) {
        const num = parseInt(p.hospitalId, 10);
        if (!isNaN(num) && num > maxNumericId) maxNumericId = num;
      }

      let nextIdNumber = maxNumericId + 1;
      let babyHospitalId;
      let attempts = 0;
      while (attempts < 5) {
        babyHospitalId = ((nextIdNumber * 9301 + 12345) % 1000000).toString().padStart(6, '0');
        const existing = await tx.patient.findFirst({ where: { hospitalId: babyHospitalId } });
        if (!existing) break;
        attempts++;
        nextIdNumber++;
      }

      let babyEmail = mother.email
        ? `baby_${babyHospitalId}@${mother.email.split('@')[1] || 'hospital.com'}`
        : `baby_${babyHospitalId}@hospital.com`;

      let emailExists = await tx.patient.findFirst({ where: { email: babyEmail } });
      let counter = 1;
      while (emailExists) {
        babyEmail = `baby_${babyHospitalId}_${counter}@${mother.email ? (mother.email.split('@')[1] || 'hospital.com') : 'hospital.com'}`;
        emailExists = await tx.patient.findFirst({ where: { email: babyEmail } });
        counter++;
      }

      const baby = await tx.patient.create({
        data: {
          hospitalId: babyHospitalId,
          firstName: `Baby ${mother.firstName}`,
          lastName: mother.lastName,
          dateOfBirth: deliveryDate ? new Date(deliveryDate) : new Date(),
          gender: babyGender,
          phone: mother.phone || null,
          email: babyEmail,
          address: mother.address || null,
          emergencyContact: mother.emergencyContact || null,
          allergies: mother.allergies || null,
          nextOfKinName: mother.firstName + ' ' + mother.lastName,
          nextOfKinPhone: mother.phone || null,
          nextOfKinRelationship: 'Mother',
          patientCategory: 'FPP',
          updatedAt: new Date()
        }
      });

      let paediatricsClinic = await tx.clinic.findFirst({
        where: { name: { equals: 'Paediatrics', mode: 'insensitive' } }
      });
      if (!paediatricsClinic) {
        paediatricsClinic = await tx.clinic.create({
          data: {
            name: 'Paediatrics',
            description: 'Paediatrics Clinic for newborns and children',
            location: 'Main Hospital - Ground Floor',
            updatedAt: new Date()
          }
        });
      }

      await tx.patientJourney.create({
        data: {
          patientId: baby.id,
          destinationType: 'CLINIC',
          clinicId: paediatricsClinic.id,
          registeredById: req.user.id,
          status: 'SENT_TO_DESTINATION',
          sentToDestinationAt: new Date(),
          updatedAt: new Date()
        }
      });

      await tx.clinicalNote.create({
        data: {
          patientId: baby.id,
          authorId: req.user.id,
          type: 'Delivery Note',
          fullContent: `🩺 NEWBORN DELIVERY REPORT\n\n👶 Baby: ${baby.firstName} ${baby.lastName}\n🆔 Hospital ID: ${baby.hospitalId}\n📅 DOB: ${new Date(deliveryDate || new Date()).toLocaleString()}\n👤 Gender: ${babyGender}\n⚖️ Weight: ${babyWeight || 'Not recorded'} kg\n💉 Apgar: ${babyApgar1min || 'N/A'} / ${babyApgar5min || 'N/A'} / ${babyApgar10min || 'N/A'}\n\n👩 Mother: ${mother.firstName} ${mother.lastName} (${mother.hospitalId})\n🩺 Type: ${type}\n🏥 Transferred to Paediatrics`,
          updatedAt: new Date()
        }
      });

      await tx.patient_notifications.create({
        data: {
          patientId: baby.id,
          title: '🎉 Newborn Registration',
          message: `Welcome! ${baby.firstName} ${baby.lastName} has been registered and transferred to Paediatrics.`,
          type: 'registration'
        }
      });

      await tx.patient_notifications.create({
        data: {
          patientId: mother.id,
          title: '🤱 Delivery Completed',
          message: `Congratulations! You delivered a ${babyGender} baby weighing ${babyWeight || 'not recorded'} kg.`,
          type: 'delivery'
        }
      });

      await tx.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'RECORD_DELIVERY',
          module: 'Antenatal',
          details: `Delivery recorded for pregnancy ${pregnancyId}. Baby ${baby.hospitalId} transferred to Paediatrics.`
        }
      });

      return { delivery, baby, paediatricsClinic };
    });

    res.status(201).json({
      success: true,
      message: '✅ Delivery recorded successfully! Baby transferred to Paediatrics.',
      delivery: {
        id: result.delivery.id,
        type: result.delivery.type,
        date: result.delivery.deliveryDate,
        durationHours: result.delivery.durationHours,
        outcome: result.delivery.outcome,
        babyWeight: result.delivery.babyWeight,
        babyLength: result.delivery.babyLength,
        babyHeadCircumference: result.delivery.babyHeadCircumference,
        babyApgar1min: result.delivery.babyApgar1min,
        babyApgar5min: result.delivery.babyApgar5min,
        babyApgar10min: result.delivery.babyApgar10min,
        maternalCondition: result.delivery.maternalCondition
      },
      baby: {
        id: result.baby.id,
        hospitalId: result.baby.hospitalId,
        firstName: result.baby.firstName,
        lastName: result.baby.lastName,
        gender: result.baby.gender,
        dateOfBirth: result.baby.dateOfBirth
      },
      mother: {
        id: mother.id,
        hospitalId: mother.hospitalId,
        firstName: mother.firstName,
        lastName: mother.lastName
      },
      paediatricsClinic: result.paediatricsClinic
    });
  } catch (error) {
    console.error('Record delivery error:', error);
    res.status(500).json({ error: error.message || 'Failed to record delivery' });
  }
});

// ============================================================
// DENTAL
// ============================================================
app.post('/api/dental', authenticate, authorize('Doctor', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const { patientId, teethNumber, condition, treatmentPlan, procedure, notes } = req.body;
    if (!patientId || !condition) return res.status(400).json({ error: 'Patient ID and condition are required' });
    const dentalRecord = await req.db.dental_records.create({
      data: { patientId, teethNumber, condition, treatmentPlan, procedure, notes, staffId: req.user.id },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } }, Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_DENTAL_RECORD',
        module: 'Dental',
        details: `Created dental record for patient ${dentalRecord.Patient.hospitalId}`
      }
    });
    res.status(201).json({ ...dentalRecord, patient: dentalRecord.Patient, staff: dentalRecord.Staff });
  } catch (error) {
    console.error('Create dental record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dental/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await req.db.dental_records.findMany({
      where: { patientId },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { examinationDate: 'desc' }
    });
    res.json(records.map(r => ({ ...r, staff: r.Staff })));
  } catch (error) {
    console.error('Get dental records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/dental/:id', authenticate, authorize('Doctor', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { teethNumber, condition, treatmentPlan, procedure, notes } = req.body;
    const record = await req.db.dental_records.update({
      where: { id },
      data: { teethNumber, condition, treatmentPlan, procedure, notes },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } }, Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    res.json({ ...record, patient: record.Patient, staff: record.Staff });
  } catch (error) {
    console.error('Update dental record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dental/patients', authenticate, authorize('Dentist', 'Admin'), async (req, res) => {
  try {
    const patients = await req.db.patient.findMany({
      where: { dental_records: { some: {} } },
      select: {
        id: true, hospitalId: true, firstName: true, lastName: true,
        phone: true, email: true, gender: true, dateOfBirth: true,
        dental_records: { orderBy: { examinationDate: 'desc' }, take: 1 }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(patients);
  } catch (error) {
    console.error('Get dental patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dental/chart/:patientId', authenticate, authorize('Dentist', 'Admin'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await req.db.dental_records.findMany({
      where: { patientId },
      orderBy: { examinationDate: 'desc' }
    });
    const chart = Array.from({ length: 32 }, (_, i) => ({
      toothNumber: i + 1, status: 'healthy', procedures: [], records: []
    }));
    records.forEach(record => {
      if (record.teethNumber) {
        const teeth = record.teethNumber.split(',').map(t => parseInt(t.trim()));
        teeth.forEach(toothNum => {
          const index = toothNum - 1;
          if (index >= 0 && index < 32) {
            const c = (record.condition || '').toLowerCase();
            if (c === 'cavity') chart[index].status = 'cavity';
            else if (c === 'filling') chart[index].status = 'filled';
            else if (c === 'missing') chart[index].status = 'missing';
            else if (c === 'crown') chart[index].status = 'crown';
            else chart[index].status = 'treated';
            chart[index].procedures.push(record.procedure || record.condition);
            chart[index].records.push(record);
          }
        });
      }
    });
    res.json({ chart, records });
  } catch (error) {
    console.error('Get dental chart error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dental/procedures', authenticate, authorize('Dentist', 'Admin'), async (req, res) => {
  try {
    const procedures = [
      { code: 'D0150', name: 'Comprehensive Oral Evaluation', category: 'Evaluation' },
      { code: 'D0210', name: 'Intraoral - Complete Series', category: 'Radiographs' },
      { code: 'D1110', name: 'Prophylaxis - Adult', category: 'Prophylaxis' },
      { code: 'D2140', name: 'Amalgam - One Surface', category: 'Restorative' },
      { code: 'D2150', name: 'Amalgam - Two Surfaces', category: 'Restorative' },
      { code: 'D2330', name: 'Resin - One Surface', category: 'Restorative' },
      { code: 'D2740', name: 'Crown - Porcelain/Ceramic', category: 'Crowns' },
      { code: 'D7140', name: 'Extraction - Erupted Tooth', category: 'Oral Surgery' },
      { code: 'D7210', name: 'Extraction - Surgical', category: 'Oral Surgery' }
    ];
    res.json(procedures);
  } catch (error) {
    console.error('Get dental procedures error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// OPTOMETRY
// ============================================================
app.post('/api/optometry', authenticate, authorize('Doctor', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const {
      patientId, visualAcuityRight, visualAcuityLeft,
      intraocularPressureRight, intraocularPressureLeft,
      refractionRight, refractionLeft, diagnosis, treatment, prescription, notes
    } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });

    const exam = await req.db.optometry_records.create({
      data: {
        patientId, visualAcuityRight, visualAcuityLeft,
        intraocularPressureRight: intraocularPressureRight ? parseFloat(intraocularPressureRight) : null,
        intraocularPressureLeft: intraocularPressureLeft ? parseFloat(intraocularPressureLeft) : null,
        refractionRight, refractionLeft, diagnosis, treatment, prescription, notes,
        staffId: req.user.id
      },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } }, Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    res.status(201).json({ ...exam, patient: exam.Patient, staff: exam.Staff });
  } catch (error) {
    console.error('Create optometry record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/optometry/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await req.db.optometry_records.findMany({
      where: { patientId },
      include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { examinationDate: 'desc' }
    });
    res.json(records.map(r => ({ ...r, staff: r.Staff })));
  } catch (error) {
    console.error('Get optometry records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/optometry/patients', authenticate, authorize('Optometrist', 'Admin'), async (req, res) => {
  try {
    const patients = await req.db.patient.findMany({
      where: { optometry_records: { some: {} } },
      select: {
        id: true, hospitalId: true, firstName: true, lastName: true,
        phone: true, email: true, gender: true, dateOfBirth: true,
        optometry_records: { orderBy: { examinationDate: 'desc' }, take: 1 }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(patients);
  } catch (error) {
    console.error('Get optometry patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/optometry/exam/:patientId', authenticate, authorize('Optometrist', 'Admin'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await req.db.optometry_records.findMany({
      where: { patientId },
      orderBy: { examinationDate: 'desc' }
    });
    res.json(records);
  } catch (error) {
    console.error('Get eye exam error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/optometry/exam', authenticate, authorize('Optometrist', 'Admin'), async (req, res) => {
  try {
    const {
      patientId, visualAcuityRight, visualAcuityLeft,
      intraocularPressureRight, intraocularPressureLeft,
      refractionRight, refractionLeft, diagnosis, treatment, prescription, notes
    } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });

    const exam = await req.db.optometry_records.create({
      data: {
        patientId, visualAcuityRight, visualAcuityLeft,
        intraocularPressureRight: intraocularPressureRight ? parseFloat(intraocularPressureRight) : null,
        intraocularPressureLeft: intraocularPressureLeft ? parseFloat(intraocularPressureLeft) : null,
        refractionRight, refractionLeft, diagnosis, treatment, prescription, notes,
        staffId: req.user.id
      },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } }, Staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
    });
    res.status(201).json({ ...exam, patient: exam.Patient, staff: exam.Staff });
  } catch (error) {
    console.error('Create eye exam error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/optometry/prescription', authenticate, authorize('Optometrist', 'Admin'), async (req, res) => {
  try {
    const {
      patientId, prescriptionType,
      rightSphere, rightCylinder, rightAxis,
      leftSphere, leftCylinder, leftAxis,
      addPower, pd, notes, expiryDate
    } = req.body;
    if (!patientId || !prescriptionType) {
      return res.status(400).json({ error: 'Patient ID and prescription type are required' });
    }

    const prescription = await req.db.optometry_records.create({
      data: {
        patientId,
        prescription: `Type: ${prescriptionType}\nRight: ${rightSphere || '0'} ${rightCylinder || '0'} @ ${rightAxis || '0'}°\nLeft: ${leftSphere || '0'} ${leftCylinder || '0'} @ ${leftAxis || '0'}°\nAdd: ${addPower || '0'}\nPD: ${pd || 'Not specified'}\n${notes || ''}`,
        notes: `Prescription issued. Valid until: ${expiryDate || '1 year'}`,
        staffId: req.user.id,
        examinationDate: new Date()
      },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } } }
    });
    res.status(201).json({ ...prescription, patient: prescription.Patient });
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// IMMUNIZATIONS
// ============================================================
app.post('/api/immunizations', authenticate, authorize('Doctor', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const {
      patientId, vaccineName, doseNumber, administrationDate,
      route, site, batchNumber, expiryDate, nextDueDate,
      administeredBy, notes
    } = req.body;
    if (!patientId || !vaccineName || !administrationDate) {
      return res.status(400).json({ error: 'Patient ID, vaccine name, and administration date are required' });
    }

    const immunization = await req.db.immunizations.create({
      data: {
        patientId, vaccineName,
        doseNumber: doseNumber || 1,
        administrationDate: new Date(administrationDate),
        route: route || 'IM',
        site: site || 'Deltoid',
        batchNumber,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        administeredBy: administeredBy || `${req.user.firstName} ${req.user.lastName}`,
        notes
      },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, dateOfBirth: true } } }
    });

    if (nextDueDate) {
      await req.db.patient_notifications.create({
        data: {
          patientId,
          title: 'Vaccination Reminder',
          message: `Your next dose of ${vaccineName} is due on ${new Date(nextDueDate).toLocaleDateString()}`,
          type: 'vaccination'
        }
      });
    }

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_IMMUNIZATION',
        module: 'Immunization',
        details: `Recorded ${vaccineName} (dose ${doseNumber}) for patient ${immunization.Patient.hospitalId}`
      }
    });
    res.status(201).json({ ...immunization, patient: immunization.Patient });
  } catch (error) {
    console.error('Create immunization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/immunizations/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const immunizations = await req.db.immunizations.findMany({
      where: { patientId },
      orderBy: { administrationDate: 'desc' }
    });
    res.json(immunizations);
  } catch (error) {
    console.error('Get immunizations error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/immunizations/patient/:patientId/schedule', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const immunizations = await req.db.immunizations.findMany({
      where: { patientId, nextDueDate: { not: null } },
      orderBy: { nextDueDate: 'asc' }
    });
    res.json(immunizations);
  } catch (error) {
    console.error('Get immunization schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/immunizations/:id', authenticate, authorize('Doctor', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vaccineName, doseNumber, administrationDate, route, site,
      batchNumber, expiryDate, nextDueDate, notes
    } = req.body;

    const immunization = await req.db.immunizations.update({
      where: { id },
      data: {
        vaccineName, doseNumber,
        administrationDate: administrationDate ? new Date(administrationDate) : undefined,
        route, site, batchNumber,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        notes
      },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } } }
    });
    res.json({ ...immunization, patient: immunization.Patient });
  } catch (error) {
    console.error('Update immunization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/immunizations/overdue', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = await req.db.immunizations.findMany({
      where: { nextDueDate: { lt: today } },
      include: { Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { nextDueDate: 'asc' }
    });
    res.json(overdue.map(o => ({ ...o, patient: o.Patient })));
  } catch (error) {
    console.error('Get overdue immunizations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PATIENT QUEUE MANAGEMENT
// ============================================================
app.post('/api/patient/checkin', authenticate, async (req, res) => {
  try {
    const { patientId, hospitalId, phone, appointmentId, checkInMethod } = req.body;
    let patient;
    if (patientId) patient = await req.db.patient.findUnique({ where: { id: patientId } });
    else if (hospitalId) patient = await req.db.patient.findFirst({ where: { hospitalId } });
    else if (phone) patient = await req.db.patient.findFirst({ where: { phone } });
    if (!patient) return res.status(404).json({ error: 'Patient not found. Please check the ID or phone number.' });

    let appointment = null;
    if (appointmentId) {
      appointment = await req.db.appointment.findUnique({
        where: { id: appointmentId },
        include: { Staff: true, Patient: true }
      });
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      appointment = await req.db.appointment.findFirst({
        where: { patientId: patient.id, dateTime: { gte: today, lt: tomorrow }, status: 'Scheduled' },
        include: { Staff: true, Patient: true }
      });
    }

    let destinationType = 'CLINIC';
    let clinicId = null;
    let wardId = null;
    if (appointment) {
      const staff = await req.db.staff.findUnique({
        where: { id: appointment.staffId },
        include: { StaffClinic: { select: { clinicId: true } } }
      });
      if (staff?.StaffClinic?.length > 0) clinicId = staff.StaffClinic[0].clinicId;
    }

    const queueEntry = await req.db.patientQueue.create({
      data: {
        patientId: patient.id,
        checkInMethod: checkInMethod || 'manual_entry',
        status: 'waiting',
        priority: appointment?.priority || 'normal',
        appointmentId: appointment?.id || null,
        destinationType, clinicId, wardId,
        assignedTo: appointment?.staffId || null,
        notes: appointment
          ? `Appointment at ${new Date(appointment.dateTime).toLocaleTimeString()} with Dr. ${appointment.Staff?.firstName} ${appointment.Staff?.lastName}`
          : 'Walk-in patient',
        updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, patientCategory: true } },
        Appointment: { include: { Staff: true } }
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'PATIENT_CHECKIN',
        module: 'Queue',
        details: `Patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName} checked in`
      }
    });

    const queuePosition = await req.db.patientQueue.count({
      where: { status: 'waiting', createdAt: { lt: queueEntry.createdAt }, destinationType }
    });

    res.json({
      message: 'Patient checked in successfully',
      queueEntry: { ...queueEntry, patient: queueEntry.Patient, appointment: queueEntry.Appointment },
      queuePosition: queuePosition + 1,
      patient: {
        id: patient.id, hospitalId: patient.hospitalId,
        firstName: patient.firstName, lastName: patient.lastName,
        phone: patient.phone, patientCategory: patient.patientCategory
      },
      appointment: appointment ? { ...appointment, staff: appointment.Staff } : null,
      autoFile: {
        patientId: patient.id, hospitalId: patient.hospitalId,
        name: `${patient.firstName} ${patient.lastName}`,
        profileUrl: `/patient-profile/${patient.id}`,
        hasAppointment: !!appointment,
        appointmentTime: appointment ? new Date(appointment.dateTime).toLocaleString() : null,
        doctor: appointment?.Staff ? `Dr. ${appointment.Staff.firstName} ${appointment.Staff.lastName}` : null
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/patient/queue', authenticate, async (req, res) => {
  try {
    const { destinationType, status, date, doctorId } = req.query;
    const staffId = req.user.id;
    const userRole = req.user.role;
    let where = {};
    if (destinationType) where.destinationType = destinationType;
    if (status) where.status = status;

    if (['Doctor', 'Obstetrician'].includes(userRole)) {
      const staff = await req.db.staff.findUnique({
        where: { id: staffId },
        include: {
          StaffClinic: { select: { clinicId: true } },
          StaffWard: { select: { wardId: true } }
        }
      });
      const clinicIds = staff?.StaffClinic?.map(c => c.clinicId) || [];
      const wardIds = staff?.StaffWard?.map(w => w.wardId) || [];
      where.OR = [{ assignedTo: staffId }, { clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }];
    } else if (['Nurse', 'Midwife'].includes(userRole)) {
      const staff = await req.db.staff.findUnique({
        where: { id: staffId },
        include: {
          StaffClinic: { select: { clinicId: true } },
          StaffWard: { select: { wardId: true } }
        }
      });
      const clinicIds = staff?.StaffClinic?.map(c => c.clinicId) || [];
      const wardIds = staff?.StaffWard?.map(w => w.wardId) || [];
      where.OR = [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }];
    }

    if (date) {
      const filterDate = new Date(date); filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate); nextDay.setDate(nextDay.getDate() + 1);
      where.checkInTime = { gte: filterDate, lt: nextDay };
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      where.checkInTime = { gte: today, lt: tomorrow };
    }
    if (doctorId) where.assignedTo = doctorId;

    const queue = await req.db.patientQueue.findMany({
      where,
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true, patientCategory: true } },
        Appointment: { include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        Clinic: true, Ward: true,
        Staff: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: [{ priority: 'desc' }, { checkInTime: 'asc' }]
    });

    const queueWithPositions = queue.map((entry, index) => {
      const waitTime = Math.floor((Date.now() - new Date(entry.checkInTime).getTime()) / 60000);
      return {
        ...entry,
        patient: entry.Patient,
        appointment: entry.Appointment,
        clinic: entry.Clinic,
        ward: entry.Ward,
        assignedStaff: entry.Staff,
        position: index + 1,
        waitTimeMinutes: waitTime
      };
    });

    res.json({
      total: queue.length,
      waiting: queue.filter(q => q.status === 'waiting').length,
      inProgress: queue.filter(q => q.status === 'in_progress').length,
      completed: queue.filter(q => q.status === 'completed').length,
      queue: queueWithPositions
    });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patient/queue/next', authenticate, async (req, res) => {
  try {
    const { destinationType } = req.body;
    const staffId = req.user.id;

    const nextPatient = await req.db.patientQueue.findFirst({
      where: { status: 'waiting', destinationType: destinationType || 'CLINIC' },
      orderBy: [{ priority: 'desc' }, { checkInTime: 'asc' }],
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true, patientCategory: true } },
        Appointment: { include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        Clinic: true, Ward: true, Staff: true
      }
    });
    if (!nextPatient) return res.status(404).json({ message: 'No patients waiting' });

    const updated = await req.db.patientQueue.update({
      where: { id: nextPatient.id },
      data: {
        status: 'in_progress',
        assignedTo: staffId,
        calledTime: new Date(),
        startTime: new Date(),
        updatedAt: new Date()
      },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true, patientCategory: true } },
        Appointment: { include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        Clinic: true, Ward: true, Staff: true
      }
    });

    const waitTime = Math.floor((Date.now() - new Date(nextPatient.checkInTime).getTime()) / 60000);

    res.json({
      message: 'Patient called',
      patient: {
        ...updated,
        patient: updated.Patient,
        appointment: updated.Appointment,
        clinic: updated.Clinic,
        ward: updated.Ward,
        assignedStaff: updated.Staff
      },
      waitTimeMinutes: waitTime,
      autoFile: {
        patientId: updated.Patient.id,
        hospitalId: updated.Patient.hospitalId,
        name: `${updated.Patient.firstName} ${updated.Patient.lastName}`,
        profileUrl: `/patient-profile/${updated.Patient.id}`,
        queueId: updated.id
      }
    });
  } catch (error) {
    console.error('Call next patient error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/patient/queue/:id/complete', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const queueEntry = await req.db.patientQueue.update({
      where: { id },
      data: { status: 'completed', endTime: new Date(), notes: notes || undefined, updatedAt: new Date() },
      include: {
        Patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true, phone: true } },
        Appointment: { include: { Staff: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        Clinic: true, Ward: true, Staff: true
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'PATIENT_COMPLETED',
        module: 'Queue',
        details: `Patient ${queueEntry.Patient?.hospitalId} visit completed`
      }
    });
    res.json({
      message: 'Patient visit completed',
      queueEntry: {
        ...queueEntry,
        patient: queueEntry.Patient,
        appointment: queueEntry.Appointment,
        clinic: queueEntry.Clinic,
        ward: queueEntry.Ward,
        assignedStaff: queueEntry.Staff
      }
    });
  } catch (error) {
    console.error('Complete visit error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/patient/queue/stats', authenticate, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, waiting, inProgress, completed, cancelled] = await Promise.all([
      req.db.patientQueue.count({ where: { checkInTime: { gte: today, lt: tomorrow } } }),
      req.db.patientQueue.count({ where: { status: 'waiting', checkInTime: { gte: today, lt: tomorrow } } }),
      req.db.patientQueue.count({ where: { status: 'in_progress', checkInTime: { gte: today, lt: tomorrow } } }),
      req.db.patientQueue.count({ where: { status: 'completed', checkInTime: { gte: today, lt: tomorrow } } }),
      req.db.patientQueue.count({ where: { status: 'cancelled', checkInTime: { gte: today, lt: tomorrow } } })
    ]);

    const completedPatients = await req.db.patientQueue.findMany({
      where: {
        status: 'completed', checkInTime: { gte: today, lt: tomorrow },
        startTime: { not: null }, endTime: { not: null }
      }
    });

    let avgWaitTime = 0;
    let avgServiceTime = 0;
    if (completedPatients.length > 0) {
      const totalWaitTime = completedPatients.reduce((sum, p) =>
        new Date(p.startTime).getTime() - new Date(p.checkInTime).getTime() + sum, 0);
      avgWaitTime = Math.round(totalWaitTime / completedPatients.length / 60000);
      const totalServiceTime = completedPatients.reduce((sum, p) =>
        new Date(p.endTime).getTime() - new Date(p.startTime).getTime() + sum, 0);
      avgServiceTime = Math.round(totalServiceTime / completedPatients.length / 60000);
    }

    res.json({
      today: { total, waiting, inProgress, completed, cancelled },
      averages: { avgWaitTimeMinutes: avgWaitTime, avgServiceTimeMinutes: avgServiceTime }
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/my-queue', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const queueEntry = await req.db.patientQueue.findFirst({
      where: { patientId, status: { in: ['waiting', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        Appointment: { include: { Staff: true } },
        Clinic: true, Ward: true
      }
    });
    if (!queueEntry) return res.json({ message: 'You are not currently in the queue' });

    const position = await req.db.patientQueue.count({
      where: {
        status: 'waiting',
        createdAt: { lt: queueEntry.createdAt },
        destinationType: queueEntry.destinationType
      }
    });
    const waitTime = Math.floor((Date.now() - new Date(queueEntry.checkInTime).getTime()) / 60000);

    res.json({
      queueEntry,
      position: position + 1,
      waitTimeMinutes: waitTime,
      estimatedWaitTime: (position + 1) * 15
    });
  } catch (error) {
    console.error('Get my queue status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PATIENT SEARCH (public + authed)
// ============================================================
app.get('/api/patient/search/quick', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json([]);
    const patients = await req.db.patient.findMany({
      where: {
        isArchived: false,
        OR: [
          { hospitalId: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true, hospitalId: true, firstName: true, lastName: true,
        phone: true, gender: true, patientCategory: true, dateOfBirth: true
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    res.json(patients);
  } catch (error) {
    console.error('Quick search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/patient/search', async (req, res) => {
  try {
    const { query, tenantId, hospitalSlug } = req.query;
    if (!query || query.length < 2) return res.json([]);

    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && hospitalSlug) {
      const hospital = await prisma.hospital.findUnique({
        where: { slug: hospitalSlug },
        select: { id: true }
      });
      resolvedTenantId = hospital?.id;
    }
    if (!resolvedTenantId) {
      return res.status(400).json({ error: 'tenantId or hospitalSlug query parameter is required' });
    }

    const patients = await prisma.patient.findMany({
      where: {
        tenantId: resolvedTenantId,
        isArchived: false,
        OR: [
          { hospitalId: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true, hospitalId: true, firstName: true, lastName: true,
        phone: true, gender: true, patientCategory: true, dateOfBirth: true
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    res.json(patients);
  } catch (error) {
    console.error('Kiosk search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// TENANT-AWARE WALLET HELPER
// ============================================================
async function deductFromWallet(patientId, amount, description, category, serviceId, serviceType, staffId, tenantId) {
  try {
    if (!tenantId) {
      return { success: false, error: 'tenantId is required', code: 'NO_TENANT' };
    }
    const db = getTenantPrisma(tenantId);

    let staffName = 'Unknown Staff';
    if (staffId) {
      const staff = await db.staff.findUnique({
        where: { id: staffId },
        select: { firstName: true, lastName: true, username: true, role: true }
      });
      if (staff) {
        staffName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.username || staff.role || 'Unknown Staff';
      }
    }

    const wallet = await db.patientWallet.findUnique({ where: { patientId } });
    if (!wallet) return { success: false, error: 'Wallet not found', code: 'WALLET_NOT_FOUND' };
    if (wallet.status !== 'Active') {
      return { success: false, error: `Wallet is ${wallet.status.toLowerCase()}`, code: 'WALLET_INACTIVE' };
    }
    if (wallet.balance < amount) {
      return {
        success: false,
        error: `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}`,
        code: 'INSUFFICIENT_BALANCE',
        balance: wallet.balance,
        shortfall: amount - wallet.balance
      };
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const result = await db.$transaction(async (tx) => {
      const updatedWallet = await tx.patientWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter, lastTransactionAt: new Date(), updatedAt: new Date() }
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionType: 'Payment',
          amount,
          balanceBefore,
          balanceAfter,
          description,
          reference: `DED-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'Completed',
          category: category || 'General',
          serviceId: serviceId || null,
          serviceType: serviceType || null,
          paidToStaffId: staffId || null,
          notes: `Payment processed by ${staffName}`,
          updatedAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          staffId: staffId || null,
          action: 'WALLET_AUTO_DEDUCT',
          module: 'Wallet',
          details: `Auto-deducted ₦${amount.toLocaleString()} from wallet by ${staffName} for ${description}`
        }
      });
      return { updatedWallet, transaction };
    });

    return { success: true, balanceAfter: result.updatedWallet.balance, transaction: result.transaction };
  } catch (error) {
    console.error('Wallet deduction error:', error);
    return { success: false, error: error.message, code: 'DEDUCTION_ERROR' };
  }
}

// ============================================================
// WALLET ENDPOINTS
// ============================================================
app.post('/api/wallet/check-service', authenticate, authorize('Admin', 'Records', 'BillingOfficer', 'Accountant', 'Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Radiologist'), async (req, res) => {
  try {
    const { patientId, amount, serviceName } = req.body;
    if (!patientId || !amount) {
      return res.status(400).json({ error: 'Patient ID and amount are required' });
    }
    const wallet = await req.db.patientWallet.findUnique({ where: { patientId } });
    if (!wallet) {
      return res.json({
        hasWallet: false, balance: 0, canCover: false,
        shortfall: amount, message: 'Patient does not have a wallet'
      });
    }
    const canCover = wallet.balance >= amount;
    const shortfall = canCover ? 0 : amount - wallet.balance;
    if (!canCover && wallet.balance > 0) {
      await req.db.patient_notifications.create({
        data: {
          patientId,
          title: '⚠️ Insufficient Wallet Balance',
          message: `Your wallet balance (₦${wallet.balance.toLocaleString()}) is insufficient for ${serviceName} (₦${amount.toLocaleString()}). Please deposit ₦${shortfall.toLocaleString()} to continue.`,
          type: 'wallet'
        }
      });
    }
    res.json({
      hasWallet: true, balance: wallet.balance, canCover,
      shortfall,
      message: canCover
        ? 'Sufficient balance'
        : `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}, Shortfall: ₦${shortfall.toLocaleString()}`
    });
  } catch (error) {
    console.error('Check service error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallet/process-service', authenticate, async (req, res) => {
  try {
    const { patientId, amount, description, category, serviceId, serviceType, paymentMethod } = req.body;
    if (!patientId || !amount || !description) {
      return res.status(400).json({ error: 'Patient ID, amount, and description are required' });
    }
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (paymentMethod === 'cash' || paymentMethod === 'Cash') {
      const transaction = await req.db.walletTransaction.create({
        data: {
          walletId: null,
          transactionType: 'Payment',
          amount,
          balanceBefore: 0,
          balanceAfter: 0,
          description: `${description} (Cash)`,
          reference: `CASH-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'Completed',
          category: category || 'General',
          serviceId: serviceId || null,
          serviceType: serviceType || null,
          paidToStaffId: req.user.id,
          notes: `Cash payment for ${category || 'service'}`
        }
      });
      await req.db.patient_notifications.create({
        data: {
          patientId,
          title: '💰 Payment Recorded',
          message: `Cash payment of ₦${amount.toLocaleString()} recorded for ${description}`,
          type: 'billing'
        }
      });
      return res.json({ success: true, paymentMethod: 'Cash', transaction });
    }

    const result = await deductFromWallet(
      patientId, amount, description, category, serviceId, serviceType,
      req.user.id, req.tenantId
    );
    if (!result.success) {
      if (result.code === 'INSUFFICIENT_BALANCE') {
        await req.db.patient_notifications.create({
          data: {
            patientId,
            title: '⚠️ Insufficient Wallet Balance',
            message: `Your wallet balance (₦${result.balance.toLocaleString()}) is insufficient for ${description} (₦${amount.toLocaleString()}). Please deposit ₦${result.shortfall.toLocaleString()} or pay cash.`,
            type: 'wallet'
          }
        });
        return res.status(400).json({
          success: false, error: result.error, code: result.code,
          balance: result.balance, shortfall: result.shortfall,
          options: ['deposit', 'cash', 'cancel']
        });
      }
      return res.status(400).json({ success: false, error: result.error, code: result.code });
    }

    await req.db.patient_notifications.create({
      data: {
        patientId,
        title: '✅ Payment Successful',
        message: `₦${amount.toLocaleString()} deducted from your wallet for ${description}. New balance: ₦${result.balanceAfter.toLocaleString()}`,
        type: 'wallet'
      }
    });

    const wallet = await req.db.patientWallet.findUnique({ where: { patientId } });
    if (wallet && wallet.balance < 1000) {
      await req.db.patient_notifications.create({
        data: {
          patientId,
          title: '⚠️ Low Wallet Balance',
          message: `Your wallet balance is low (₦${wallet.balance.toLocaleString()}). Please deposit more funds.`,
          type: 'wallet'
        }
      });
    }

    res.json({
      success: true,
      paymentMethod: 'Wallet',
      balanceAfter: result.balanceAfter,
      transaction: result.transaction,
      message: `✅ ₦${amount.toLocaleString()} deducted from wallet. New balance: ₦${result.balanceAfter.toLocaleString()}`
    });
  } catch (error) {
    console.error('Process service error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/wallet/notifications', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const notifications = await req.db.patient_notifications.findMany({
      where: { patientId, type: 'wallet' },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const unreadCount = await req.db.patient_notifications.count({
      where: { patientId, type: 'wallet', isRead: false }
    });
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get wallet notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/:patientId/wallet', authenticate, authorize('Admin', 'Records', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    let wallet = await req.db.patientWallet.findUnique({
      where: { patientId },
      include: { WalletTransaction: { orderBy: { createdAt: 'desc' }, take: 100 } }
    });
    if (!wallet) {
      wallet = await req.db.patientWallet.create({
        data: { patientId, balance: 0, status: 'Active', updatedAt: new Date() }
      });
    }
    res.json({
      ...wallet,
      transactions: wallet.WalletTransaction || [],
      patient: {
        id: patient.id, hospitalId: patient.hospitalId,
        firstName: patient.firstName, lastName: patient.lastName
      }
    });
  } catch (error) {
    console.error('Get patient wallet error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients/:patientId/wallet/deposit', authenticate, authorize('Admin', 'Records', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { amount, paymentMethod, paymentReference, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });

    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    let wallet = await req.db.patientWallet.findUnique({ where: { patientId } });
    if (!wallet) {
      wallet = await req.db.patientWallet.create({
        data: { patientId, balance: 0, status: 'Active', updatedAt: new Date() }
      });
    }
    if (wallet.status !== 'Active') {
      return res.status(400).json({ error: `Wallet is ${wallet.status.toLowerCase()}` });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;
    const result = await req.db.$transaction(async (tx) => {
      const updatedWallet = await tx.patientWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter, lastTransactionAt: new Date(), updatedAt: new Date() }
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionType: 'Deposit',
          amount,
          balanceBefore,
          balanceAfter,
          description: 'Cash deposit',
          reference: `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'Completed',
          paymentMethod: paymentMethod || 'Cash',
          paymentReference: paymentReference || null,
          paidToStaffId: req.user.id,
          notes: notes || null,
          updatedAt: new Date()
        }
      });
      return { updatedWallet, transaction };
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'WALLET_DEPOSIT',
        module: 'Wallet',
        details: `Deposited ₦${amount.toLocaleString()} to wallet of ${patient.hospitalId}`
      }
    });

    res.json({
      message: `₦${amount.toLocaleString()} deposited successfully`,
      wallet: result.updatedWallet,
      transaction: result.transaction
    });
  } catch (error) {
    console.error('Wallet deposit error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients/:patientId/wallet/pay', authenticate, authorize('Admin', 'Records', 'BillingOfficer', 'Accountant', 'Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Radiologist'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { amount, description, serviceId, serviceType, category } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    if (!description) return res.status(400).json({ error: 'Description is required' });

    const patient = await req.db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const wallet = await req.db.patientWallet.findUnique({ where: { patientId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.status !== 'Active') return res.status(400).json({ error: `Wallet is ${wallet.status.toLowerCase()}` });
    if (wallet.balance < amount) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}`,
        balance: wallet.balance,
        required: amount
      });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const result = await req.db.$transaction(async (tx) => {
      const updatedWallet = await tx.patientWallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter, lastTransactionAt: new Date(), updatedAt: new Date() }
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionType: 'Payment',
          amount,
          balanceBefore,
          balanceAfter,
          description,
          reference: `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'Completed',
          category: category || 'General',
          serviceId: serviceId || null,
          serviceType: serviceType || null,
          paidToStaffId: req.user.id,
          notes: 'Payment processed',
          updatedAt: new Date()
        }
      });
      return { updatedWallet, transaction };
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'WALLET_PAYMENT',
        module: 'Wallet',
        details: `Paid ₦${amount.toLocaleString()} from wallet of ${patient.hospitalId} - ${description}`
      }
    });

    res.json({
      message: `₦${amount.toLocaleString()} paid successfully from wallet`,
      wallet: result.updatedWallet,
      transaction: result.transaction
    });
  } catch (error) {
    console.error('Wallet payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/patients/:patientId/wallet/status', authenticate, authorize('Admin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status } = req.body;
    if (!status || !['Active', 'Frozen', 'Closed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (Active, Frozen, Closed)' });
    }
    const wallet = await req.db.patientWallet.findUnique({ where: { patientId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const updatedWallet = await req.db.patientWallet.update({
      where: { id: wallet.id },
      data: { status }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'WALLET_STATUS_CHANGE',
        module: 'Wallet',
        details: `Changed wallet status to ${status} for patient ${patientId}`
      }
    });
    res.json({ message: `Wallet status updated to ${status}`, wallet: updatedWallet });
  } catch (error) {
    console.error('Wallet status update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PERMISSIONS
// ============================================================
app.get('/api/permissions', authenticate, async (req, res) => {
  try {
    const perms = await prisma.rolePermission.findMany({
      where: { tenantId: req.tenantId }
    });
    res.json(perms);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/permissions/:role', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { role } = req.params;
    const updates = req.body;

    // findFirst works because (tenantId, role) is a normal filter combo
    let perm = await prisma.rolePermission.findFirst({
      where: { tenantId: req.tenantId, role }
    });

    if (!perm) {
      // create with explicit tenantId
      perm = await prisma.rolePermission.create({
        data: { tenantId: req.tenantId, role, ...updates }
      });
      return res.json(perm);
    }

    // update by primary key `id` (unique)
    const updated = await prisma.rolePermission.update({
      where: { id: perm.id },
      data: updates
    });

    res.json(updated);
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// MODULE ACCESS
// ============================================================
app.get('/api/module-access/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const userRole = req.user.role;
    const isAdmin = ['Admin', 'ITAdmin'].includes(userRole);
    const allowedModuleRoles = ['Pharmacist', 'LabTechnician', 'LabScientist', 'Radiologist'];

    if (!isAdmin && !allowedModuleRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied. Only Pharmacy, Lab, and Radiology staff can access module records.' });
    }

    const patient = await req.db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, hospitalId: true, firstName: true, lastName: true, isArchived: true, fileStatus: true }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    let moduleData = {};

    if (isAdmin) {
      const [prescriptions, labOrders, imagingOrders, medications] = await Promise.all([
        req.db.prescription.findMany({
          where: { patientId },
          include: {
            Staff_Prescription_prescribingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
            Staff_Prescription_dispensingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        req.db.labOrder.findMany({
          where: { patientId },
          include: {
            Staff_LabOrder_orderingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
            Staff_LabOrder_labStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        req.db.imagingOrder.findMany({
          where: { patientId },
          include: {
            Staff_ImagingOrder_orderingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
            Staff_ImagingOrder_radiologistIdToStaff: { select: { firstName: true, lastName: true, role: true } },
            ImagingResult: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        req.db.medication.findMany({
          where: { stockQuantity: { gt: 0 } },
          orderBy: { name: 'asc' }
        })
      ]);
      moduleData = {
        prescriptions: prescriptions.map(p => ({
          ...p, prescribedBy: p.Staff_Prescription_prescribingStaffIdToStaff,
          dispensedBy: p.Staff_Prescription_dispensingStaffIdToStaff
        })),
        labOrders: labOrders.map(l => ({
          ...l, orderedBy: l.Staff_LabOrder_orderingStaffIdToStaff,
          performedBy: l.Staff_LabOrder_labStaffIdToStaff
        })),
        imagingOrders: imagingOrders.map(i => ({
          ...i, orderingStaff: i.Staff_ImagingOrder_orderingStaffIdToStaff,
          radiologist: i.Staff_ImagingOrder_radiologistIdToStaff,
          imagingResults: i.ImagingResult
        })),
        medications,
        canDispense: true,
        canViewPrescriptions: true,
        canAddResults: true,
        canValidate: true,
        isAdmin: true
      };
    } else if (userRole === 'Pharmacist') {
      const prescriptions = await req.db.prescription.findMany({
        where: { patientId },
        include: {
          Staff_Prescription_prescribingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
          Staff_Prescription_dispensingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      const medications = await req.db.medication.findMany({
        where: { stockQuantity: { gt: 0 } },
        orderBy: { name: 'asc' }
      });
      moduleData = {
        prescriptions: prescriptions.map(p => ({
          ...p, prescribedBy: p.Staff_Prescription_prescribingStaffIdToStaff,
          dispensedBy: p.Staff_Prescription_dispensingStaffIdToStaff
        })),
        medications, canDispense: true, canViewPrescriptions: true
      };
    } else if (userRole === 'LabTechnician' || userRole === 'LabScientist') {
      const labOrders = await req.db.labOrder.findMany({
        where: { patientId },
        include: {
          Staff_LabOrder_orderingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
          Staff_LabOrder_labStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      moduleData = {
        labOrders: labOrders.map(l => ({
          ...l, orderedBy: l.Staff_LabOrder_orderingStaffIdToStaff,
          performedBy: l.Staff_LabOrder_labStaffIdToStaff
        })),
        canAddResults: true,
        canValidate: userRole === 'LabScientist'
      };
    } else if (userRole === 'Radiologist') {
      const imagingOrders = await req.db.imagingOrder.findMany({
        where: { patientId },
        include: {
          Staff_ImagingOrder_orderingStaffIdToStaff: { select: { firstName: true, lastName: true, role: true } },
          Staff_ImagingOrder_radiologistIdToStaff: { select: { firstName: true, lastName: true, role: true } },
          ImagingResult: true
        },
        orderBy: { createdAt: 'desc' }
      });
      moduleData = {
        imagingOrders: imagingOrders.map(i => ({
          ...i, orderingStaff: i.Staff_ImagingOrder_orderingStaffIdToStaff,
          radiologist: i.Staff_ImagingOrder_radiologistIdToStaff,
          imagingResults: i.ImagingResult
        })),
        canAddResults: true
      };
    }

    res.json({
      patient,
      moduleAccess: {
        role: userRole, hasAccess: true,
        canViewFullFile: false, canManageModule: true,
        moduleData, isAdmin
      }
    });
  } catch (error) {
    console.error('Module access error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/module/:module/patients', authenticate, async (req, res) => {
  try {
    const { module } = req.params;
    const userRole = req.user.role;
    const userRoleLower = userRole.toLowerCase();

    const moduleRoleMap = {
      pharmacy: ['pharmacist'],
      lab: ['labtechnician', 'labscientist'],
      radiology: ['radiologist']
    };
    const isAdmin = ['Admin', 'ITAdmin'].includes(userRole);
    const allowedRoles = moduleRoleMap[module] || [];
    const isAllowedRole = allowedRoles.includes(userRoleLower);

    if (!isAdmin && !isAllowedRole) {
      return res.status(403).json({
        error: `Access denied. ${module} module is only for authorized staff.`,
        userRole,
        allowedRoles
      });
    }

    let patients = [];

    if (module === 'pharmacy') {
      patients = await req.db.patient.findMany({
        where: { Prescription: { some: { status: { in: ['Prescribed', 'Partial'] } } } },
        select: {
          id: true, hospitalId: true, firstName: true, lastName: true, phone: true,
          Prescription: {
            where: { status: { in: ['Prescribed', 'Partial'] } },
            select: { id: true, medication: true, dosage: true, frequency: true, status: true, createdAt: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } else if (module === 'lab') {
      patients = await req.db.patient.findMany({
        where: { LabOrder: { some: { status: { in: ['Ordered', 'In Progress'] } } } },
        select: {
          id: true, hospitalId: true, firstName: true, lastName: true, phone: true,
          LabOrder: {
            where: { status: { in: ['Ordered', 'In Progress'] } },
            select: { id: true, testName: true, testType: true, priority: true, status: true, createdAt: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } else if (module === 'radiology') {
      patients = await req.db.patient.findMany({
        where: { ImagingOrder: { some: { status: { in: ['Ordered', 'Scheduled', 'In Progress'] } } } },
        select: {
          id: true, hospitalId: true, firstName: true, lastName: true, phone: true,
          ImagingOrder: {
            where: { status: { in: ['Ordered', 'Scheduled', 'In Progress'] } },
            select: { id: true, imagingType: true, bodyPart: true, priority: true, status: true, createdAt: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } else {
      return res.status(400).json({ error: 'Invalid module type' });
    }

    res.json({ module, patients, total: patients.length, role: userRole });
  } catch (error) {
    console.error(`Get ${module} patients error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DASHBOARD STATS
// ============================================================
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    let responseData = {};

    const genderDataRaw = await req.db.patient.groupBy({
      by: ['gender'],
      _count: { gender: true }
    });
    const genderData = genderDataRaw.map(g => ({
      gender: g.gender || 'Unknown',
      _count: g._count.gender || 0
    }));
    if (genderData.length === 0) genderData.push({ gender: 'Unknown', _count: 0 });

    const monthlyRegistrationsRaw = await req.db.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::int AS count
      FROM "Patient"
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
        AND "tenantId" = ${req.tenantId}
      GROUP BY month ORDER BY month ASC
    `;
    const monthlyRegistrations = monthlyRegistrationsRaw.map(item => ({
      month: item.month || 'Unknown',
      count: Number(item.count) || 0
    }));

    if (['Admin', 'Records', 'ITAdmin'].includes(role)) {
      let totalPatients = 0, totalStaff = 0, totalAppointments = 0;
      let pendingBills = 0, totalRevenue = 0, lowStockCount = 0;
      try { totalPatients = await req.db.patient.count(); } catch (e) {}
      try { totalStaff = await req.db.staff.count(); } catch (e) {}
      try { totalAppointments = await req.db.appointment.count({ where: { status: 'Scheduled' } }); } catch (e) {}
      try { pendingBills = await req.db.billingRecord.count({ where: { status: 'Pending' } }); } catch (e) {}
      try {
        const r = await req.db.billingRecord.aggregate({ _sum: { totalAmount: true }, where: { status: 'Paid' } });
        totalRevenue = r._sum.totalAmount || 0;
      } catch (e) {}
      try {
        const lsRaw = await req.db.$queryRaw`
          SELECT COUNT(*)::int AS count FROM "Medication"
          WHERE "stockQuantity" <= "reorderLevel" AND "tenantId" = ${req.tenantId}
        `;
        lowStockCount = lsRaw[0]?.count ?? 0;
      } catch (e) {}

      let wardStats = [];
      let totalAdmitted = 0, totalCapacity = 0;
      try {
        wardStats = await req.db.ward.findMany({
          select: {
            id: true, name: true, capacity: true,
            Admission: { where: { status: 'Admitted' }, select: { id: true } }
          }
        });
        totalAdmitted = wardStats.reduce((s, w) => s + w.Admission.length, 0);
        totalCapacity = wardStats.reduce((s, w) => s + (w.capacity || 0), 0);
      } catch (e) {}

      responseData = {
        totalPatients, totalStaff, totalAppointments, pendingBills,
        totalRevenue, lowStockCount,
        wardStats: wardStats.map(w => ({
          id: w.id, name: w.name, capacity: w.capacity || 0,
          admitted: w.Admission.length,
          available: (w.capacity || 0) - w.Admission.length,
          occupancyRate: w.capacity ? Math.round((w.Admission.length / w.capacity) * 100) : 0
        })),
        totalAdmitted, totalCapacity,
        overallOccupancyRate: totalCapacity ? Math.round((totalAdmitted / totalCapacity) * 100) : 0,
        genderData, monthlyRegistrations
      };
    } else if (['Doctor', 'Obstetrician'].includes(role)) {
      let myPatientsCount = 0, myAppointmentsCount = 0, prescriptionsCount = 0;
      try {
        const staff = await req.db.staff.findUnique({
          where: { id: req.user.id },
          include: {
            StaffClinic: { select: { clinicId: true } },
            StaffWard: { select: { wardId: true } }
          }
        });
        const clinicIds = staff?.StaffClinic?.map(c => c.clinicId) || [];
        const wardIds = staff?.StaffWard?.map(w => w.wardId) || [];
        if (clinicIds.length > 0 || wardIds.length > 0) {
          myPatientsCount = await req.db.patientJourney.count({
            where: {
              status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
              OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
            }
          });
        }
        myAppointmentsCount = await req.db.appointment.count({ where: { staffId: req.user.id, status: 'Scheduled' } });
        prescriptionsCount = await req.db.prescription.count({ where: { prescribingStaffId: req.user.id } });
      } catch (e) {}
      responseData = {
        myPatientsCount, myAppointmentsCount,
        myPrescriptionsCount: prescriptionsCount,
        genderData, monthlyRegistrations
      };
    } else if (['Nurse', 'Midwife'].includes(role)) {
      let myPatientsCount = 0, myAppointmentsCount = 0, vitalsCount = 0;
      try {
        const staff = await req.db.staff.findUnique({
          where: { id: req.user.id },
          include: {
            StaffClinic: { select: { clinicId: true } },
            StaffWard: { select: { wardId: true } }
          }
        });
        const clinicIds = staff?.StaffClinic?.map(c => c.clinicId) || [];
        const wardIds = staff?.StaffWard?.map(w => w.wardId) || [];
        if (clinicIds.length > 0 || wardIds.length > 0) {
          myPatientsCount = await req.db.patientJourney.count({
            where: {
              status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
              OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
            }
          });
        }
        myAppointmentsCount = await req.db.appointment.count({ where: { staffId: req.user.id, status: 'Scheduled' } });
        vitalsCount = await req.db.vitalSign.count({ where: { nurseId: req.user.id } });
      } catch (e) {}
      responseData = {
        myPatientsCount, myAppointmentsCount, myVitalsCount: vitalsCount,
        role: 'Nurse', genderData, monthlyRegistrations
      };
    } else if (role === 'Pharmacist') {
      let totalMedications = 0, lowStockCount = 0, recentDispensedCount = 0;
      try {
        totalMedications = await req.db.medication.count();
        const lsRaw = await req.db.$queryRaw`
          SELECT COUNT(*)::int AS count FROM "Medication"
          WHERE "stockQuantity" <= "reorderLevel" AND "tenantId" = ${req.tenantId}
        `;
        lowStockCount = lsRaw[0]?.count ?? 0;
        recentDispensedCount = await req.db.prescription.count({
          where: {
            status: 'Dispensed',
            createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
          }
        });
      } catch (e) {}
      responseData = { totalMedications, lowStockCount, recentDispensedCount, genderData, monthlyRegistrations };
    } else if (['Accountant', 'BillingOfficer'].includes(role)) {
      let pendingBills = 0, totalRevenue = 0, paidBillsCount = 0;
      try {
        pendingBills = await req.db.billingRecord.count({ where: { status: 'Pending' } });
        const r = await req.db.billingRecord.aggregate({ _sum: { totalAmount: true }, where: { status: 'Paid' } });
        totalRevenue = r._sum.totalAmount || 0;
        paidBillsCount = await req.db.billingRecord.count({ where: { status: 'Paid' } });
      } catch (e) {}
      responseData = { pendingBills, totalRevenue, paidBillsCount, role: 'Billing', genderData, monthlyRegistrations };
    } else if (role === 'Paediatrician') {
      let childPatients = 0, todayAppointments = 0, growthRecords = 0, vaccinationCompliance = 0;
      try {
        const eighteen = new Date(); eighteen.setFullYear(eighteen.getFullYear() - 18);
        childPatients = await req.db.patient.count({ where: { dateOfBirth: { gte: eighteen } } });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        todayAppointments = await req.db.appointment.count({
          where: { staffId: req.user.id, dateTime: { gte: today, lt: tomorrow }, status: 'Scheduled' }
        });
        growthRecords = await req.db.vitalSign.count({ where: { weight: { not: null } } });
        vaccinationCompliance = await req.db.immunizations.count({ where: { nextDueDate: { gte: new Date() } } });
      } catch (e) {}
      responseData = { role: 'Paediatrician', childPatients, todayAppointments, growthRecords, vaccinationCompliance, genderData, monthlyRegistrations };
    } else if (role === 'LabTechnician' || role === 'LabScientist') {
      let totalOrders = 0, pendingOrders = 0, completedOrders = 0;
      try {
        totalOrders = await req.db.labOrder.count();
        pendingOrders = await req.db.labOrder.count({ where: { status: { in: ['Ordered', 'In Progress'] } } });
        completedOrders = await req.db.labOrder.count({ where: { status: 'Completed' } });
      } catch (e) {}
      responseData = {
        role, summary: {
          totalOrders, pendingOrders, inProgressOrders: 0, completedOrders,
          validatedOrders: 0, cancelledOrders: 0, todaysOrders: 0, pendingCount: pendingOrders
        },
        genderData, monthlyRegistrations
      };
    } else if (role === 'Radiologist') {
      let totalOrders = 0, pendingOrders = 0, completedOrders = 0;
      try {
        totalOrders = await req.db.imagingOrder.count();
        pendingOrders = await req.db.imagingOrder.count({ where: { status: { in: ['Ordered', 'Scheduled'] } } });
        completedOrders = await req.db.imagingOrder.count({ where: { status: 'Completed' } });
      } catch (e) {}
      responseData = {
        totalImagingOrders: totalOrders,
        pendingImagingOrders: pendingOrders,
        completedImagingOrders: completedOrders,
        genderData, monthlyRegistrations
      };
    } else if (role === 'Dentist') {
      let dentalPatients = 0, todayAppointments = 0;
      try {
        dentalPatients = await req.db.patient.count({ where: { dental_records: { some: {} } } });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        todayAppointments = await req.db.appointment.count({
          where: { staffId: req.user.id, dateTime: { gte: today, lt: tomorrow }, status: 'Scheduled' }
        });
      } catch (e) {}
      responseData = {
        role: 'Dentist', totalDentalPatients: dentalPatients,
        todayAppointments, genderData, monthlyRegistrations
      };
    } else if (role === 'Optometrist') {
      let optometryPatients = 0, todayAppointments = 0;
      try {
        optometryPatients = await req.db.patient.count({ where: { optometry_records: { some: {} } } });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        todayAppointments = await req.db.appointment.count({
          where: { staffId: req.user.id, dateTime: { gte: today, lt: tomorrow }, status: 'Scheduled' }
        });
      } catch (e) {}
      responseData = {
        role: 'Optometrist', totalOptometryPatients: optometryPatients,
        todayAppointments, genderData, monthlyRegistrations
      };
    } else if (role === 'Surgeon') {
      let surgeryPatients = 0, todayAppointments = 0, pendingLabOrders = 0;
      try {
        const surgeryClinic = await req.db.clinic.findFirst({ where: { name: { contains: 'Surgery', mode: 'insensitive' } } });
        if (surgeryClinic) {
          surgeryPatients = await req.db.patientJourney.count({
            where: { clinicId: surgeryClinic.id, status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] } }
          });
        }
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        todayAppointments = await req.db.appointment.count({
          where: { staffId: req.user.id, dateTime: { gte: today, lt: tomorrow }, status: 'Scheduled' }
        });
        pendingLabOrders = await req.db.labOrder.count({
          where: { orderingStaffId: req.user.id, status: { in: ['Ordered', 'In Progress'] } }
        });
      } catch (e) {}
      responseData = { role: 'Surgeon', surgeryPatients, todayAppointments, pendingLabOrders, genderData, monthlyRegistrations };
    } else if (role === 'Psychiatrist') {
      let psychiatryPatients = 0, todayAppointments = 0, mentalHealthNotes = 0;
      try {
        const psychiatryClinic = await req.db.clinic.findFirst({ where: { name: { contains: 'Psychiatry', mode: 'insensitive' } } });
        if (psychiatryClinic) {
          psychiatryPatients = await req.db.patientJourney.count({
            where: { clinicId: psychiatryClinic.id, status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] } }
          });
        }
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        todayAppointments = await req.db.appointment.count({
          where: { staffId: req.user.id, dateTime: { gte: today, lt: tomorrow }, status: 'Scheduled' }
        });
        mentalHealthNotes = await req.db.clinicalNote.count({
          where: {
            authorId: req.user.id,
            OR: [
              { type: { contains: 'Psychiatric', mode: 'insensitive' } },
              { fullContent: { contains: 'mental', mode: 'insensitive' } }
            ]
          }
        });
      } catch (e) {}
      responseData = { role: 'Psychiatrist', psychiatryPatients, todayAppointments, mentalHealthNotes, genderData, monthlyRegistrations };
    } else if (role === 'Receptionist') {
      let totalPatients = 0, todayAppointments = 0, pendingIntake = 0;
      try {
        totalPatients = await req.db.patient.count();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        todayAppointments = await req.db.appointment.count({
          where: { dateTime: { gte: today, lt: tomorrow }, status: 'Scheduled' }
        });
        pendingIntake = await req.db.patientJourney.count({ where: { status: 'REGISTERED' } });
      } catch (e) {}
      responseData = { role: 'Receptionist', totalPatients, todayAppointments, pendingIntake, genderData, monthlyRegistrations };
    } else {
      let totalPatients = 0;
      try { totalPatients = await req.db.patient.count(); } catch (e) {}
      responseData = { message: 'Stats for this role are work in progress', role, totalPatients, genderData, monthlyRegistrations };
    }

    if (!responseData.genderData) responseData.genderData = genderData;
    if (!responseData.monthlyRegistrations) responseData.monthlyRegistrations = monthlyRegistrations;
    res.json(responseData);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: error.message, role: req.user?.role || 'unknown' });
  }
});

// ============================================================
// DEPARTMENTS (generic alias — used by DepartmentManagement.jsx)
// Mirrors the HR department endpoints but lives at /api/departments
// ============================================================
app.get('/api/departments', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const departments = await req.db.department.findMany({
      include: {
        staff: {
          select: { id: true, firstName: true, lastName: true, role: true, employeeId: true }
        },
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json({ departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/departments', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { name, description, managerId, location, costCenter } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Guard: unique name per tenant
    const existing = await req.db.department.findFirst({
      where: { name: name.trim() }
    });
    if (existing) {
      return res.status(400).json({ error: 'A department with this name already exists' });
    }

    // If a manager is being assigned, make sure they aren't already managing another dept
    if (managerId) {
      const conflict = await req.db.department.findFirst({
        where: { managerId }
      });
      if (conflict) {
        return res.status(400).json({
          error: `This staff member already manages "${conflict.name}". A staff member can only manage one department.`
        });
      }
    }

    const department = await req.db.department.create({
      data: {
        name: name.trim(),
        description: description || null,
        managerId: managerId || null,
        location: location || null,
        costCenter: costCenter || null,
        isActive: true
      },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        staff: { select: { id: true, firstName: true, lastName: true, role: true, employeeId: true } }
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_DEPARTMENT',
        module: 'HR',
        details: `Created department: ${department.name}`
      }
    });

    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Department name already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/departments/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, managerId, location, costCenter, isActive } = req.body;

    const existing = await req.db.department.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Department not found' });

    // If name is changing, ensure no other dept has it
    if (name && name.trim() !== existing.name) {
      const conflict = await req.db.department.findFirst({
        where: { name: name.trim(), NOT: { id } }
      });
      if (conflict) {
        return res.status(400).json({ error: 'Another department already uses this name' });
      }
    }

    // If a manager is being assigned, ensure they don't manage another dept
    if (managerId && managerId !== existing.managerId) {
      const conflict = await req.db.department.findFirst({
        where: { managerId, NOT: { id } }
      });
      if (conflict) {
        return res.status(400).json({
          error: `This staff member already manages "${conflict.name}". A staff member can only manage one department.`
        });
      }
    }

    const department = await req.db.department.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        managerId: managerId !== undefined ? (managerId || null) : undefined,
        location: location !== undefined ? location : undefined,
        costCenter: costCenter !== undefined ? costCenter : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        staff: { select: { id: true, firstName: true, lastName: true, role: true, employeeId: true } }
      }
    });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_DEPARTMENT',
        module: 'HR',
        details: `Updated department: ${department.name}`
      }
    });

    res.json(department);
  } catch (error) {
    console.error('Update department error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Department name already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/departments/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;

    const department = await req.db.department.findUnique({
      where: { id },
      include: { _count: { select: { staff: true } } }
    });
    if (!department) return res.status(404).json({ error: 'Department not found' });

    // Block delete if any staff still assigned
    if (department._count.staff > 0) {
      return res.status(400).json({
        error: `Cannot delete "${department.name}". ${department._count.staff} staff member(s) are still assigned to it. Reassign or deactivate them first.`
      });
    }

    await req.db.department.delete({ where: { id } });

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_DEPARTMENT',
        module: 'HR',
        details: `Deleted department: ${department.name} (${id})`
      }
    });

    res.json({ message: 'Department deleted successfully', department: { id, name: department.name } });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// HR MODULE
// ============================================================
app.get('/api/hr/departments', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const departments = await req.db.Department.findMany({
      include: {
        staff: {
          select: { id: true, firstName: true, lastName: true, role: true, employeeId: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/departments', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { name, description, managerId, location, costCenter } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });
    const department = await req.db.Department.create({
      data: { name, description, managerId: managerId || null, location, costCenter },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });
    await req.db.auditLog.create({
      data: { staffId: req.user.id, action: 'CREATE_DEPARTMENT', module: 'HR', details: `Created department: ${name}` }
    });
    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/hr/departments/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, managerId, location, costCenter, isActive } = req.body;
    const department = await req.db.Department.update({
      where: { id },
      data: {
        name, description,
        managerId: managerId || null,
        location, costCenter,
        isActive: isActive !== undefined ? isActive : true
      },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });
    await req.db.auditLog.create({
      data: { staffId: req.user.id, action: 'UPDATE_DEPARTMENT', module: 'HR', details: `Updated department: ${name}` }
    });
    res.json(department);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/hr/departments/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const staffCount = await req.db.staff.count({ where: { departmentId: id } });
    if (staffCount > 0) {
      return res.status(400).json({ error: 'Cannot delete department with assigned staff. Reassign or deactivate staff first.' });
    }
    await req.db.Department.delete({ where: { id } });
    await req.db.auditLog.create({
      data: { staffId: req.user.id, action: 'DELETE_DEPARTMENT', module: 'HR', details: `Deleted department ID: ${id}` }
    });
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/hr/employees', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { department, status, search } = req.query;
    const where = {};
    if (department) where.departmentId = department;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    const employees = await req.db.staff.findMany({ where, orderBy: { createdAt: 'desc' } });
    const formatted = employees.map(emp => {
      const { password, ...rest } = emp;
      return { ...rest, pendingLeaves: 0, lastReview: null, trainings: [] };
    });
    res.json(formatted);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/employees/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await req.db.staff.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    const { password, ...rest } = employee;
    res.json(rest);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/employees/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employeeId, firstName, lastName, email, role,
      departmentId, managerId, dateOfBirth, gender,
      phone, address, emergencyContact, employmentType,
      startDate, endDate, salary, bankName, bankAccount,
      bankBranch, taxId, nationalId, isActive
    } = req.body;

    const employee = await req.db.staff.update({
      where: { id },
      data: {
        employeeId, firstName, lastName, email, role,
        departmentId: departmentId || null,
        manager_id: managerId || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender, phone, address, emergencyContact, employmentType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        salary: salary ? parseFloat(salary) : null,
        bankName, bankAccount, bankBranch, taxId, nationalId,
        isActive: isActive !== undefined ? isActive : true
      },
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_EMPLOYEE',
        module: 'HR',
        details: `Updated employee: ${employee.firstName} ${employee.lastName}`
      }
    });
    const { password, ...rest } = employee;
    res.json(rest);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/hr/leaves', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { status, employeeId, dateFrom, dateTo } = req.query;
    const where = {};
    if (status) where.status = status;
    if (employeeId) where.staff_id = employeeId;
    if (dateFrom || dateTo) {
      where.start_date = {};
      if (dateFrom) where.start_date.gte = new Date(dateFrom);
      if (dateTo) where.start_date.lte = new Date(dateTo);
    }
    const leaves = await req.db.leave_requests.findMany({
      where,
      include: {
        Staff_leave_requests_staff_idToStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true, role: true }
        },
        Staff_leave_requests_approved_by_idToStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(leaves.map(l => ({
      ...l,
      staff: l.Staff_leave_requests_staff_idToStaff,
      approvedBy: l.Staff_leave_requests_approved_by_idToStaff
    })));
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/leaves', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { staffId, leaveType, startDate, endDate, reason, contactDuringLeave, substituteId } = req.body;
    if (!staffId || !leaveType || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const staff = await req.db.staff.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const overlapping = await req.db.leave_requests.findFirst({
      where: {
        staff_id: staffId,
        status: 'Approved',
        start_date: { lte: new Date(endDate) },
        end_date: { gte: new Date(startDate) }
      }
    });
    if (overlapping) return res.status(400).json({ error: 'Employee already has an approved leave during this period' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await req.db.leave_requests.create({
      data: {
        staff_id: staffId,
        leave_type: leaveType,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        days,
        reason,
        contact_during_leave: contactDuringLeave,
        substitute_id: substituteId || null,
        status: 'Pending'
      },
      include: {
        Staff_leave_requests_staff_idToStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        Staff_leave_requests_substitute_idToStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_LEAVE_REQUEST',
        module: 'HR',
        details: `${staff.firstName} ${staff.lastName} requested ${leaveType} leave (${days} days)`
      }
    });
    res.status(201).json({
      ...leave,
      staff: leave.Staff_leave_requests_staff_idToStaff,
      substitute: leave.Staff_leave_requests_substitute_idToStaff
    });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/hr/leaves/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;
    if (!status || !['Approved', 'Rejected', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const leave = await req.db.leave_requests.update({
      where: { id },
      data: {
        status,
        approved_by_id: req.user.id,
        approved_at: new Date(),
        comments
      },
      include: {
        Staff_leave_requests_staff_idToStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        Staff_leave_requests_approved_by_idToStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      }
    });
    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'LEAVE_APPROVAL',
        module: 'HR',
        details: `${leave.Staff_leave_requests_staff_idToStaff?.firstName} ${leave.Staff_leave_requests_staff_idToStaff?.lastName} leave ${status}`
      }
    });
    res.json({
      ...leave,
      staff: leave.Staff_leave_requests_staff_idToStaff,
      approvedBy: leave.Staff_leave_requests_approved_by_idToStaff
    });
  } catch (error) {
    console.error('Update leave error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/hr/dashboard', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalEmployees = await req.db.staff.count();
    const activeEmployees = await req.db.staff.count({ where: { isActive: true } });
    const departments = await req.db.Department.count({ where: { isActive: true } });
    const pendingLeaves = await req.db.leave_requests.count({ where: { status: 'Pending' } });
    const employeesOnLeave = await req.db.leave_requests.count({
      where: { status: 'Approved', start_date: { lte: today }, end_date: { gte: today } }
    });

    let clockedInToday = 0;
    try {
      clockedInToday = await req.db.attendance.count({
        where: { date: today, clock_in: { not: null }, clock_out: null }
      });
    } catch (e) {}

    let totalTrainings = 0;
    try {
      totalTrainings = await req.db.trainings.count({
        where: {
          start_date: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
            lte: new Date(today.getFullYear(), today.getMonth() + 1, 0)
          }
        }
      });
    } catch (e) {}

    const recentLeaves = await req.db.leave_requests.findMany({
      take: 5,
      where: { status: 'Pending' },
      include: {
        Staff_leave_requests_staff_idToStaff: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      statistics: {
        totalEmployees, activeEmployees, departments,
        pendingLeaves, employeesOnLeave, clockedInToday, totalTrainings
      },
      recentLeaves: recentLeaves.map(l => ({
        ...l,
        staff: l.Staff_leave_requests_staff_idToStaff
      })),
      recentEmployees: []
    });
  } catch (error) {
    console.error('HR dashboard error:', error);
    res.status(500).json({
      statistics: {
        totalEmployees: 0, activeEmployees: 0, departments: 0,
        pendingLeaves: 0, employeesOnLeave: 0, clockedInToday: 0, totalTrainings: 0
      },
      recentLeaves: [], recentEmployees: []
    });
  }
});

app.get('/api/hr/leave-policy', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    let policy = await req.db.leave_policies.findFirst({ where: { is_active: true } });
    if (!policy) {
      policy = await req.db.leave_policies.create({
        data: {
          name: 'Default Policy',
          description: 'Standard leave policy for all employees',
          default_annual_days: 21,
          default_sick_days: 10,
          default_study_days: 5,
          default_maternity_days: 90,
          default_paternity_days: 14,
          max_carry_over_days: 5,
          leave_year_start_month: 1,
          leave_year_end_month: 12,
          pro_rata_enabled: true,
          reminder_days: 30,
          is_active: true
        }
      });
    }
    res.json(policy);
  } catch (error) {
    console.error('Get leave policy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/leave-policy', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const {
      defaultAnnualDays, defaultSickDays, defaultStudyDays,
      defaultMaternityDays, defaultPaternityDays, maxCarryOverDays,
      carryOverExpiry, leaveYearStartMonth, leaveYearEndMonth,
      proRataEnabled, reminderDays
    } = req.body;
    await req.db.leave_policies.updateMany({
      where: { is_active: true },
      data: {
        default_annual_days: defaultAnnualDays,
        default_sick_days: defaultSickDays,
        default_study_days: defaultStudyDays,
        default_maternity_days: defaultMaternityDays,
        default_paternity_days: defaultPaternityDays,
        max_carry_over_days: maxCarryOverDays,
        carry_over_expiry: carryOverExpiry,
        leave_year_start_month: leaveYearStartMonth,
        leave_year_end_month: leaveYearEndMonth,
        pro_rata_enabled: proRataEnabled,
        reminder_days: reminderDays
      }
    });
    await req.db.auditLog.create({
      data: { staffId: req.user.id, action: 'UPDATE_LEAVE_POLICY', module: 'HR', details: 'Updated leave policy settings' }
    });
    res.json({ message: 'Leave policy updated successfully' });
  } catch (error) {
    console.error('Update leave policy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/leave-entitlement', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { staffId, year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    if (!staffId) {
      const entitlements = await req.db.staff_leave_entitlements.findMany({
        where: { year: targetYear },
        include: {
          Staff: { select: { id: true, firstName: true, lastName: true, employeeId: true, role: true } }
        },
        orderBy: { Staff: { firstName: 'asc' } }
      });
      return res.json(entitlements);
    }

    const entitlement = await req.db.staff_leave_entitlements.findFirst({
      where: { staff_id: staffId, year: targetYear },
      include: {
        Staff: { select: { id: true, firstName: true, lastName: true, employeeId: true, role: true } }
      }
    });
    if (!entitlement) {
      return res.status(404).json({ message: 'No leave entitlement found for this staff member', hasEntitlement: false });
    }
    res.json(entitlement);
  } catch (error) {
    console.error('Get leave entitlement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/leave-entitlement', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const {
      staffId, year, annualLeaveDays, sickLeaveDays, studyLeaveDays,
      maternityLeaveDays, paternityLeaveDays, carriedOverDays, notes
    } = req.body;

    if (!staffId || !year) return res.status(400).json({ error: 'Staff ID and year are required' });

    const annualLeave = annualLeaveDays ?? 21;
    const sickLeave = sickLeaveDays ?? 10;
    const studyLeave = studyLeaveDays ?? 5;
    const maternityLeave = maternityLeaveDays ?? 90;
    const paternityLeave = paternityLeaveDays ?? 14;
    const carriedOver = carriedOverDays ?? 0;
    const totalAvailable = annualLeave + carriedOver;

    const existing = await req.db.staff_leave_entitlements.findFirst({
      where: { staff_id: staffId, year }
    });

    const data = {
      annual_leave_days: annualLeave,
      sick_leave_days: sickLeave,
      study_leave_days: studyLeave,
      maternity_leave_days: maternityLeave,
      paternity_leave_days: paternityLeave,
      carried_over_days: carriedOver,
      total_available_days: totalAvailable,
      remaining_annual_days: annualLeave,
      remaining_sick_days: sickLeave,
      remaining_study_days: studyLeave,
      remaining_maternity_days: maternityLeave,
      remaining_paternity_days: paternityLeave,
      notes,
      updated_by: req.user.id
    };

    let entitlement;
    if (existing) {
      entitlement = await req.db.staff_leave_entitlements.update({
        where: { id: existing.id },
        data,
        include: { Staff: { select: { id: true, firstName: true, lastName: true, employeeId: true } } }
      });
    } else {
      entitlement = await req.db.staff_leave_entitlements.create({
        data: {
          staff_id: staffId,
          year,
          ...data,
          created_by: req.user.id
        },
        include: { Staff: { select: { id: true, firstName: true, lastName: true, employeeId: true } } }
      });
    }

    await req.db.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_LEAVE_ENTITLEMENT',
        module: 'HR',
        details: `Leave entitlement for ${entitlement.Staff?.firstName} ${entitlement.Staff?.lastName} (${year})`
      }
    });
    res.json({ message: 'Leave entitlement saved successfully', entitlement });
  } catch (error) {
    console.error('Create leave entitlement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/my-leave-balance', authenticate, async (req, res) => {
  try {
    const staffId = req.user.id;
    const currentYear = new Date().getFullYear();
    const entitlement = await req.db.staff_leave_entitlements.findFirst({
      where: { staff_id: staffId, year: currentYear }
    });
    if (!entitlement) {
      return res.json({ message: 'No leave entitlement found for this year. Please contact HR.', hasEntitlement: false });
    }
    res.json({
      hasEntitlement: true,
      year: currentYear,
      annual: {
        total: entitlement.annual_leave_days,
        remaining: entitlement.remaining_annual_days,
        carriedOver: entitlement.carried_over_days
      },
      sick: { total: entitlement.sick_leave_days, remaining: entitlement.remaining_sick_days },
      study: { total: entitlement.study_leave_days || 0, remaining: entitlement.remaining_study_days || 0 },
      maternity: { total: entitlement.maternity_leave_days || 0, remaining: entitlement.remaining_maternity_days || 0 },
      paternity: { total: entitlement.paternity_leave_days || 0, remaining: entitlement.remaining_paternity_days || 0 }
    });
  } catch (error) {
    console.error('Get my leave balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PAYMENT GATEKEEPING
// ============================================================
function getPaymentMessage(path, amount, walletBalance, category) {
  const formattedAmount = `₦${amount.toLocaleString()}`;
  const formattedBalance = `₦${walletBalance.toLocaleString()}`;
  switch (path) {
    case 'NO_PAYMENT': return 'No payment required for this service';
    case 'WALLET': return `✅ Wallet has sufficient balance (${formattedBalance}). ${formattedAmount} will be deducted automatically.`;
    case 'PARTIAL_WALLET_OR_CASH': return `⚠️ Wallet balance (${formattedBalance}) is insufficient for ${formattedAmount}. Patient must pay the difference.`;
    case 'BILLING': return `💰 Payment of ${formattedAmount} required. Patient has no active wallet. Send to billing.`;
    default: return 'Payment required';
  }
}

app.post('/api/services/check-payment', authenticate, async (req, res) => {
  try {
    const { patientId, serviceName, serviceType, amount: customAmount, quantity = 1 } = req.body;
    if (!patientId || !serviceName || !serviceType) {
      return res.status(400).json({ error: 'Patient ID, service name, and service type are required' });
    }

    const patient = await req.db.patient.findUnique({
      where: { id: patientId },
      include: { PatientWallet: true }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const category = patient.patientCategory || 'FPP';
    let price = 0;
    let priceBreakdown = {};

    if (serviceType === 'MEDICATION' || serviceType === 'DRUG') {
      const medication = await req.db.medication.findFirst({
        where: { name: { contains: serviceName, mode: 'insensitive' } }
      });
      if (!medication) return res.status(404).json({ error: 'Medication not found in inventory' });

      const basePrice = medication.unitPrice || 0;
      if (category === 'NHIS') {
        const nhisPrice = await req.db.nHISDrugPrice.findFirst({
          where: { medicationId: medication.id, isActive: true }
        });
        if (nhisPrice) {
          price = nhisPrice.patientCopay || (nhisPrice.nhisPrice * 0.1);
          priceBreakdown = {
            basePrice: nhisPrice.standardPrice,
            nhisPrice: nhisPrice.nhisPrice,
            patientCopay: nhisPrice.patientCopay,
            category: 'NHIS'
          };
        } else {
          price = basePrice * 0.1;
          priceBreakdown = { basePrice, category: 'NHIS' };
        }
      } else if (category === 'RETAINER' || category === 'CORPORATE') {
        price = basePrice * 2;
        priceBreakdown = { basePrice, category: 'RETAINER' };
      } else {
        price = basePrice;
        priceBreakdown = { basePrice, category: 'FPP' };
      }
      price = price * quantity;
      priceBreakdown.quantity = quantity;
      priceBreakdown.medicationId = medication.id;
    } else if (['LAB', 'IMAGING', 'PROCEDURE'].includes(serviceType)) {
      const service = await req.db.servicePricing.findFirst({
        where: { name: { contains: serviceName, mode: 'insensitive' }, isActive: true }
      });
      if (!service) return res.status(404).json({ error: 'Service not found in pricing catalog' });

      let finalPrice = service.basePrice || 0;
      if (category === 'NHIS' && service.nhisPrice) finalPrice = service.nhisPrice;
      else if ((category === 'RETAINER' || category === 'CORPORATE') && service.corporatePrice) finalPrice = service.corporatePrice;

      price = finalPrice * quantity;
      priceBreakdown = { basePrice: service.basePrice, category, serviceId: service.id };
      priceBreakdown.quantity = quantity;
    } else {
      if (!customAmount) return res.status(400).json({ error: 'Custom amount required' });
      price = parseFloat(customAmount) * quantity;
      priceBreakdown = { category, customAmount };
    }

    const wallet = patient.PatientWallet;
    const walletBalance = wallet?.balance || 0;
    const hasEnoughBalance = walletBalance >= price;
    const canUseWallet = wallet && wallet.status === 'Active' && hasEnoughBalance;

    let paymentPath;
    const requiresPayment = price > 0;
    if (!requiresPayment) paymentPath = 'NO_PAYMENT';
    else if (canUseWallet) paymentPath = 'WALLET';
    else if (walletBalance > 0 && !hasEnoughBalance) paymentPath = 'PARTIAL_WALLET_OR_CASH';
    else paymentPath = 'BILLING';

    res.json({
      patient: {
        id: patient.id, hospitalId: patient.hospitalId,
        firstName: patient.firstName, lastName: patient.lastName, category
      },
      service: { name: serviceName, type: serviceType, quantity },
      pricing: { totalAmount: price, ...priceBreakdown },
      wallet: {
        exists: !!wallet, balance: walletBalance,
        status: wallet?.status || 'None',
        hasEnoughBalance,
        shortfall: hasEnoughBalance ? 0 : price - walletBalance
      },
      decision: {
        requiresPayment, canUseWallet, paymentPath,
        message: getPaymentMessage(paymentPath, price, walletBalance, category)
      }
    });
  } catch (error) {
    console.error('Payment check error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services/process-and-authorize', authenticate, async (req, res) => {
  try {
    const { patientId, serviceName, serviceType, quantity = 1, paymentMethod, referenceId } = req.body;

    const patient = await req.db.patient.findUnique({
      where: { id: patientId },
      include: { PatientWallet: true }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const category = patient.patientCategory || 'FPP';
    let amount = 0;
    let priceBreakdown = {};

    if (serviceType === 'MEDICATION' || serviceType === 'DRUG') {
      const medication = await req.db.medication.findFirst({
        where: { name: { contains: serviceName, mode: 'insensitive' } }
      });
      if (!medication) return res.status(404).json({ error: 'Medication not found' });

      const basePrice = medication.unitPrice || 0;
      if (category === 'NHIS') {
        const nhisPrice = await req.db.nHISDrugPrice.findFirst({
          where: { medicationId: medication.id, isActive: true }
        });
        amount = nhisPrice
          ? (nhisPrice.patientCopay || nhisPrice.nhisPrice * 0.1)
          : basePrice * 0.1;
      } else if (category === 'RETAINER' || category === 'CORPORATE') {
        amount = basePrice * 2;
      } else {
        amount = basePrice;
      }
      amount = amount * quantity;
      priceBreakdown = { basePrice, category, medicationId: medication.id };
    } else if (['LAB', 'IMAGING', 'PROCEDURE'].includes(serviceType)) {
      const service = await req.db.servicePricing.findFirst({
        where: { name: { contains: serviceName, mode: 'insensitive' }, isActive: true }
      });
      if (!service) return res.status(404).json({ error: 'Service not found in pricing catalog' });

      let finalPrice = service.basePrice || 0;
      if (category === 'NHIS' && service.nhisPrice) finalPrice = service.nhisPrice;
      else if ((category === 'RETAINER' || category === 'CORPORATE') && service.corporatePrice) finalPrice = service.corporatePrice;

      amount = finalPrice * quantity;
      priceBreakdown = { basePrice: service.basePrice, category, serviceId: service.id };
    } else {
      return res.status(400).json({ error: 'Unknown service type' });
    }

    if (amount <= 0) return res.status(400).json({ error: 'Invalid amount calculated' });

    if (paymentMethod === 'WALLET') {
      const walletResult = await deductFromWallet(
        patientId, amount,
        `Payment for ${serviceName} (${serviceType})`,
        serviceType, referenceId, serviceType.toLowerCase(),
        req.user.id, req.tenantId
      );
      if (!walletResult.success) {
        return res.status(400).json({
          error: walletResult.error, code: walletResult.code,
          balance: walletResult.balance, shortfall: walletResult.shortfall
        });
      }
      const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await req.db.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'SERVICE_PAYMENT',
          module: serviceType,
          details: `Wallet payment of ₦${amount.toLocaleString()} for ${serviceName} - Receipt: ${receiptNumber}`
        }
      });
      return res.json({
        success: true, authorized: true, paymentMethod: 'WALLET',
        amountPaid: amount,
        balanceAfter: walletResult.balanceAfter,
        receipt: {
          number: receiptNumber,
          date: new Date().toISOString(),
          patient: {
            id: patient.id, hospitalId: patient.hospitalId,
            firstName: patient.firstName, lastName: patient.lastName, category
          },
          service: { name: serviceName, type: serviceType, quantity },
          amount, category, paymentMethod: 'WALLET',
          issuedBy: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.role
        },
        message: `✅ ₦${amount.toLocaleString()} deducted from wallet.`
      });
    }

    if (['CASH', 'TRANSFER', 'BILLING'].includes(paymentMethod)) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const invoiceNumber = `INV-${new Date().getFullYear()}-${timestamp}-${random}`;

      const billingRecord = await req.db.billingRecord.create({
        data: {
          patientId, invoiceNumber,
          items: [{
            name: serviceName, category: serviceType,
            amount, status: 'Paid', serviceType
          }],
          totalAmount: amount, paidAmount: amount, balance: 0,
          status: 'Paid',
          paymentMethod: paymentMethod === 'BILLING' ? 'Cash' : paymentMethod,
          paymentDate: new Date(),
          description: `${serviceName} (${quantity} unit${quantity > 1 ? 's' : ''})`,
          processedBy: req.user.id,
          receiptGenerated: true,
          receiptGeneratedAt: new Date(),
          updatedAt: new Date()
        }
      });

      const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await req.db.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'SERVICE_PAYMENT',
          module: serviceType,
          details: `${paymentMethod} payment of ₦${amount.toLocaleString()} for ${serviceName} - Invoice: ${invoiceNumber}`
        }
      });
      return res.json({
        success: true, authorized: true, paymentMethod, amountPaid: amount,
        billingRecord,
        receipt: {
          number: receiptNumber, invoiceNumber,
          date: new Date().toISOString(),
          patient: {
            id: patient.id, hospitalId: patient.hospitalId,
            firstName: patient.firstName, lastName: patient.lastName, category
          },
          service: { name: serviceName, type: serviceType, quantity },
          amount, category, paymentMethod,
          issuedBy: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.role
        },
        message: `✅ Payment of ₦${amount.toLocaleString()} recorded.`
      });
    }
    return res.status(400).json({ error: 'Invalid payment method' });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DISCHARGE PATIENT
// ============================================================
app.post('/api/patients/:id/discharge', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, dischargeType = 'NORMAL' } = req.body;

    const allowedRoles = ['Admin', 'ITAdmin', 'Doctor', 'Obstetrician', 'Records', 'BillingOfficer', 'Accountant'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to discharge patients' });
    }

    const patient = await req.db.patient.findUnique({
      where: { id },
      include: {
        BillingRecord: { where: { status: { in: ['Pending', 'Partial'] } } }
      }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (patient.isDischarged) {
      return res.status(400).json({
        error: 'Patient is already discharged',
        code: 'ALREADY_DISCHARGED',
        dischargedAt: patient.dischargedAt
      });
    }

    const pendingBills = patient.BillingRecord || [];
    const totalPending = pendingBills.reduce((sum, b) => sum + (b.balance || 0), 0);
    if (pendingBills.length > 0 && totalPending > 0) {
      return res.status(400).json({
        error: 'Cannot discharge patient. Outstanding balance exists.',
        code: 'OUTSTANDING_BALANCE',
        outstandingAmount: totalPending,
        pendingBills: pendingBills.map(b => ({
          id: b.id, invoiceNumber: b.invoiceNumber, balance: b.balance
        }))
      });
    }

    const [pendingPrescriptions, pendingLab, pendingImaging] = await Promise.all([
      req.db.prescription.count({ where: { patientId: id, status: 'Prescribed' } }),
      req.db.labOrder.count({ where: { patientId: id, status: { in: ['Ordered', 'In Progress'] } } }),
      req.db.imagingOrder.count({ where: { patientId: id, status: { in: ['Ordered', 'Scheduled', 'In Progress'] } } })
    ]);
    if (pendingPrescriptions > 0 || pendingLab > 0 || pendingImaging > 0) {
      return res.status(400).json({
        error: 'Cannot discharge patient. Pending services exist.',
        code: 'PENDING_SERVICES',
        pending: { prescriptions: pendingPrescriptions, labOrders: pendingLab, imagingOrders: pendingImaging }
      });
    }

    const dischargedAt = new Date();
    const autoArchiveAt = new Date(dischargedAt.getTime() + 24 * 60 * 60 * 1000);

    const result = await req.db.$transaction(async (tx) => {
      const updatedPatient = await tx.patient.update({
        where: { id },
        data: {
          isDischarged: true, dischargedAt,
          dischargedBy: req.user.id,
          dischargeType,
          dischargeNotes: notes || 'Patient discharged',
          fileStatus: 'DISCHARGED',
          autoArchiveAt,
          lastAccessedAt: new Date(),
          updatedAt: new Date()
        }
      });

      await tx.patientJourney.updateMany({
        where: { patientId: id, status: { not: 'COMPLETED' } },
        data: { status: 'COMPLETED', completedAt: dischargedAt, updatedAt: new Date() }
      });

      await tx.admission.updateMany({
        where: { patientId: id, status: 'Admitted' },
        data: {
          status: 'Discharged',
          dischargeDate: dischargedAt,
          notes: notes || 'Patient discharged',
          updatedAt: new Date()
        }
      });

      const dischargeNote = await tx.clinicalNote.create({
        data: {
          patientId: id,
          authorId: req.user.id,
          type: 'Discharge Summary',
          fullContent: `🩺 DISCHARGE SUMMARY\n\n📅 Discharge Date: ${dischargedAt.toLocaleString()}\n🆔 Patient: ${patient.firstName} ${patient.lastName} (${patient.hospitalId})\n🏥 Discharge Type: ${dischargeType}\n\n💰 Financial Status:\n- All bills cleared ✅\n- No pending payments ✅\n\n📋 Notes:\n${notes || 'Patient discharged in stable condition.'}\n\n⏰ Auto-Archive Scheduled: ${autoArchiveAt.toLocaleString()}\n\n✍️ Discharged by: ${req.user.firstName || ''} ${req.user.lastName || ''} (${req.user.role})`,
          updatedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'DISCHARGE_PATIENT',
          module: 'Patient',
          details: `Discharged patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}. Type: ${dischargeType}. Auto-archive at: ${autoArchiveAt.toISOString()}`
        }
      });

      return { dischargeNote, updatedPatient };
    });

    res.json({
      success: true,
      message: `✅ Patient ${patient.firstName} ${patient.lastName} discharged successfully`,
      patient: {
        id: patient.id, hospitalId: patient.hospitalId,
        firstName: patient.firstName, lastName: patient.lastName,
        isDischarged: true, dischargedAt, dischargeType,
        fileStatus: 'DISCHARGED', autoArchiveAt
      },
      dischargeDate: dischargedAt, dischargeType, autoArchiveAt,
      dischargeNote: result.dischargeNote,
      dischargeNoteId: result.dischargeNote.id
    });
  } catch (error) {
    console.error('Discharge error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/:id/discharge-check', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await req.db.patient.findUnique({
      where: { id },
      include: {
        BillingRecord: { where: { status: { in: ['Pending', 'Partial'] } } },
        PatientWallet: true
      }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (patient.isDischarged) {
      return res.json({
        patientId: id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        hospitalId: patient.hospitalId,
        isDischarged: true,
        dischargedAt: patient.dischargedAt,
        dischargeType: patient.dischargeType,
        autoArchiveAt: patient.autoArchiveAt,
        fileStatus: patient.fileStatus,
        isReadyForDischarge: false,
        blockers: [],
        message: 'Patient is already discharged'
      });
    }

    const [pendingPrescriptions, pendingLab, pendingImaging, activeJourneys, activeAdmissions] = await Promise.all([
      req.db.prescription.count({ where: { patientId: id, status: 'Prescribed' } }),
      req.db.labOrder.count({ where: { patientId: id, status: { in: ['Ordered', 'In Progress'] } } }),
      req.db.imagingOrder.count({ where: { patientId: id, status: { in: ['Ordered', 'Scheduled', 'In Progress'] } } }),
      req.db.patientJourney.count({ where: { patientId: id, status: { not: 'COMPLETED' } } }),
      req.db.admission.count({ where: { patientId: id, status: 'Admitted' } })
    ]);

    const pendingBills = patient.BillingRecord || [];
    const totalOutstanding = pendingBills.reduce((sum, b) => sum + (b.balance || 0), 0);

    const isReadyForDischarge =
      totalOutstanding === 0 && pendingPrescriptions === 0 && pendingLab === 0 &&
      pendingImaging === 0 && activeJourneys === 0 && activeAdmissions === 0;

    const blockers = [];
    if (totalOutstanding > 0) {
      blockers.push({
        type: 'OUTSTANDING_BALANCE',
        message: `Outstanding balance: ₦${totalOutstanding.toLocaleString()}`,
        details: pendingBills.map(b => ({ invoiceNumber: b.invoiceNumber, balance: b.balance }))
      });
    }
    if (pendingPrescriptions > 0) blockers.push({ type: 'PENDING_PRESCRIPTIONS', message: `${pendingPrescriptions} prescription(s) not yet dispensed` });
    if (pendingLab > 0) blockers.push({ type: 'PENDING_LAB', message: `${pendingLab} lab test(s) pending` });
    if (pendingImaging > 0) blockers.push({ type: 'PENDING_IMAGING', message: `${pendingImaging} imaging order(s) pending` });
    if (activeJourneys > 0) blockers.push({ type: 'ACTIVE_JOURNEY', message: `${activeJourneys} active patient journey` });
    if (activeAdmissions > 0) blockers.push({ type: 'ACTIVE_ADMISSION', message: 'Patient still admitted' });

    res.json({
      patientId: id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      hospitalId: patient.hospitalId,
      isDischarged: false,
      isReadyForDischarge,
      blockers,
      summary: {
        outstandingBalance: totalOutstanding,
        walletBalance: patient.PatientWallet?.balance || 0,
        pendingPrescriptions, pendingLab, pendingImaging,
        activeJourneys, activeAdmissions
      }
    });
  } catch (error) {
    console.error('Discharge check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CRON LOCK HELPERS
// ============================================================
//
// Each cron job is guarded by a PostgreSQL advisory lock. This means
// even if the app is running on N instances (e.g. 3 Render dynos),
// only ONE instance will execute each job per tick. The others skip
// quietly.
//
// We use two-argument pg_try_advisory_lock(key1, key2):
//   key1 = a fixed class ID unique to this app (must fit in int32)
//   key2 = a job-specific int32 hash (billing, backup, cleanup)
//
// The lock is session-scoped, so as long as we hold the same Prisma
// connection, the lock stays held. We release it in a `finally` block
// so a crash mid-job doesn't block the next tick forever.
//
// Cost: one extra query per cron tick per instance (negligible).
// Dependencies: none — Postgres already has advisory locks built in.
//
const CRON_LOCK_CLASS_ID = 0x454D52; // "EMR" as a 32-bit int

async function withCronLock(jobName, jobFn) {
  // Hash jobName to a stable int32 so different jobs use different lock IDs
  let hash = 0;
  for (let i = 0; i < jobName.length; i++) {
    hash = ((hash << 5) - hash + jobName.charCodeAt(i)) | 0;
  }
  const lockId = Math.abs(hash);

  let lockAcquired = false;

  try {
    // Try to acquire the lock, non-blocking
    const result = await prisma.$queryRaw`
      SELECT pg_try_advisory_lock(${CRON_LOCK_CLASS_ID}::int, ${lockId}::int) AS acquired
    `;
    lockAcquired = Boolean(result?.[0]?.acquired);

    if (!lockAcquired) {
      // Another instance is running this job right now — skip quietly
      return;
    }

    // We hold the lock — run the job
    await jobFn();
  } catch (error) {
    console.error(`❌ [CRON ${jobName}] Error:`, error);
  } finally {
    if (lockAcquired) {
      try {
        await prisma.$queryRaw`
          SELECT pg_advisory_unlock(${CRON_LOCK_CLASS_ID}::int, ${lockId}::int)
        `;
      } catch (unlockErr) {
        console.warn(`⚠️  [CRON ${jobName}] Failed to release lock:`, unlockErr.message);
      }
    }
  }
}

// ============================================================
// CRON: Auto-advance PENDING_BILLING → BILLING_CLEARED
// Runs every 60 seconds. For each tenant that has
// autoAdvanceBillingAfterMinutes set, finds journeys that:
//   1. Are in PENDING_BILLING status
//   2. Have a BillingRecord with status = 'Paid'
//   3. Have been in that state for > autoAdvanceBillingAfterMinutes
// …and advances them automatically.
// ============================================================
cron.schedule('* * * * *', async () => {
  await withCronLock('auto-advance-billing', async () => {
  
    // Get all tenants that have auto-advance enabled
    const settingsWithAutoAdvance = await prisma.hospitalSettings.findMany({
      where: {
        autoAdvanceBillingAfterMinutes: { not: null },
      },
      select: {
        tenantId: true,
        autoAdvanceBillingAfterMinutes: true,
      },
    });

    if (settingsWithAutoAdvance.length === 0) return;

    let totalAdvanced = 0;

    for (const settings of settingsWithAutoAdvance) {
      const cutoff = new Date(
        Date.now() - settings.autoAdvanceBillingAfterMinutes * 60 * 1000
      );

      // Find stuck journeys in this tenant
      const stuck = await prisma.patientJourney.findMany({
        where: {
          tenantId: settings.tenantId,
          status: 'PENDING_BILLING',
          billingRecord: {
            status: 'Paid',
            paymentDate: { lt: cutoff },
          },
        },
        select: {
          id: true,
          patientId: true,
          billingRecordId: true,
          Patient: { select: { hospitalId: true, firstName: true, lastName: true } },
          BillingRecord: { select: { invoiceNumber: true, paymentDate: true } },
        },
      });

      for (const journey of stuck) {
        await prisma.$transaction(async (tx) => {
          // Advance the journey
          await tx.patientJourney.update({
            where: { id: journey.id },
            data: {
              status: 'BILLING_CLEARED',
              updatedAt: new Date(),
            },
          });

          // Audit the auto-advance
          await tx.auditLog.create({
  data: {
    tenantId: settings.tenantId,
    staffId: null,                              // ← was 'system'
    action: 'AUTO_ADVANCE_JOURNEY_TIMEOUT',
    module: 'Billing',
    details:
      `Auto-advanced journey ${journey.id} from PENDING_BILLING → BILLING_CLEARED ` +
      `after ${settings.autoAdvanceBillingAfterMinutes} min (invoice ${journey.BillingRecord?.invoiceNumber}, ` +
      `patient ${journey.Patient?.hospitalId} ${journey.Patient?.firstName} ${journey.Patient?.lastName})`,
  },
});
        });

        totalAdvanced++;
      }
    }

    if (totalAdvanced > 0) {
      console.log(`✅ [CRON] Auto-advanced ${totalAdvanced} journey(ies) past PENDING_BILLING`);
    }
  });
}, { timezone: 'Africa/Lagos' });

console.log('✅ Auto-advance billing cron scheduled: every minute (Africa/Lagos)');

// ============================================================
// CRON JOBS
// ============================================================
cron.schedule('0 2 * * *', async () => {
  await withCronLock('daily-backup', async () => {
    console.log('\n🔄 [CRON] Daily backup starting...');
    try {
      await backupDatabase();
    } catch (error) {
      console.error('❌ [CRON] Backup failed:', error.message);
    }
  });
}, { timezone: 'Africa/Lagos' });

console.log('✅ Backup cron scheduled: 2:00 AM daily (Africa/Lagos)');

cron.schedule('0 3 * * *', async () => {
  await withCronLock('imaging-cleanup', async () => {
    console.log('\n🧹 [CRON] Imaging file cleanup starting...');
    const startedAt = Date.now();
    try {
    const files = fs.readdirSync(uploadDir);
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let scanned = 0, orphaned = 0, kept = 0, skipped = 0;

    for (const file of files) {
      const filepath = path.join(uploadDir, file);
      let stats;
      try { stats = fs.statSync(filepath); } catch { continue; }
      if (!stats.isFile()) continue;
      scanned++;
      if (stats.mtimeMs > cutoff) { skipped++; continue; }

      const referenced = await prisma.imagingOrder.findFirst({
        where: {
          OR: [
            { images: { contains: file } },
            { imagesUrl: { contains: file } }
          ]
        },
        select: { id: true }
      });

      if (referenced) { kept++; }
      else {
        try { fs.unlinkSync(filepath); orphaned++; }
        catch (err) { console.error(`   ⚠️ Failed to delete ${file}: ${err.message}`); }
      }
    }

    console.log(`✅ [CRON] Cleanup complete in ${Date.now() - startedAt}ms`);
    console.log(`   Scanned:  ${scanned} files`);
    console.log(`   Kept:     ${kept} (referenced)`);
    console.log(`   Deleted:  ${orphaned} orphaned files`);
    console.log(`   Skipped:  ${skipped} (newer than 7 days)`);
   } catch (error) {
      console.error('❌ [CRON] Imaging cleanup failed:', error.message);
    }
  });
}, { timezone: 'Africa/Lagos' });

console.log('✅ Imaging cleanup cron scheduled: 3:00 AM daily (Africa/Lagos)');

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 EMR System Server Running on port ${PORT}`);
  console.log('='.repeat(50));
});