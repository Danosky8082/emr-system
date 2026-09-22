// src/routes/platform.js
require('dotenv').config();

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma-client');
const { createDefaultRolePermissions } = require('../permission-templates');
const { createDefaultHospitalData } = require('../hospital-templates');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

// Sanity check
if (!JWT_SECRET) {
  console.warn('⚠️  [platform] JWT_SECRET is not set — using insecure fallback!');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const authenticatePlatform = (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = auth.slice(7);
    const payload = jwt.verify(token, EFFECTIVE_JWT_SECRET);

    if (payload.scope !== 'platform') {
      return res.status(403).json({ error: 'Platform access required' });
    }

    req.platformUser = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin-only guard (for user management + backfill)
const requirePlatformAdmin = (req, res, next) => {
  if (req.platformUser?.role !== 'PlatformAdmin') {
    return res.status(403).json({ error: 'Only PlatformAdmin can perform this action' });
  }
  next();
};

// ============================================================
// POST /api/platform/login
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    const isEmail = identifier.includes('@');
    const user = await prisma.platformUser.findUnique({
      where: isEmail ? { email: identifier } : { username: identifier.toLowerCase() },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        scope: 'platform',
      },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Platform login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================================
// GET /api/platform/me
// ============================================================
router.get('/me', authenticatePlatform, async (req, res) => {
  try {
    const user = await prisma.platformUser.findUnique({
      where: { id: req.platformUser.id },
      select: {
        id: true, username: true, email: true,
        firstName: true, lastName: true, role: true,
        lastLogin: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Platform /me error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ============================================================
// GET /api/platform/hospitals
// ============================================================
router.get('/hospitals', authenticatePlatform, async (req, res) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            Staff: true,
            Patient: true,
            Clinic: true,
            Ward: true,
            Department: true,
            ServicePricing: true,
          },
        },
      },
    });
    res.json(hospitals);
  } catch (err) {
    console.error('❌ Platform /hospitals error:', err);
    res.status(500).json({
      error: 'Failed to load hospitals',
      details: err.message,
    });
  }
});

// ============================================================
// POST /api/platform/hospitals — create a new hospital
// (mirrors /api/super-admin/hospitals but usable from platform token)
// ============================================================
router.post('/hospitals', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    const { name, slug, code, email, phone, address, city, state, plan } = req.body;

    if (!name || !slug || !code) {
      return res.status(400).json({ error: 'name, slug, code are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Create hospital
      const hospital = await tx.hospital.create({
        data: {
          name,
          slug,
          code,
          email,
          phone,
          address,
          city,
          state,
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

      // 3) Full 20-role permission matrix
      const rolesCreated = await createDefaultRolePermissions(tx, hospital.id);

      // 4) ✅ KEY — Default clinics, wards, departments, services, configs
      const starterData = await createDefaultHospitalData(tx, hospital.id);

      return { hospital, rolesCreated, starterData };
    });

    res.status(201).json({
      ...result.hospital,
      _meta: {
        rolesCreated: result.rolesCreated,
        ...result.starterData, // clinics, wards, departments, services, configs
      },
    });
  } catch (err) {
    console.error('Platform create hospital error:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Slug or code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/platform/stats
// ============================================================
router.get('/stats', authenticatePlatform, async (req, res) => {
  try {
    const [totalHospitals, activeHospitals, totalStaff, totalPatients] = await Promise.all([
      prisma.hospital.count(),
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.staff.count(),
      prisma.patient.count(),
    ]);
    res.json({ totalHospitals, activeHospitals, totalStaff, totalPatients });
  } catch (err) {
    console.error('❌ Platform /stats error:', err);
    res.status(500).json({ error: 'Failed to load stats', details: err.message });
  }
});

// ============================================================
// PATCH /api/platform/hospitals/:id/suspend
// ============================================================
router.patch('/hospitals/:id/suspend', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    await prisma.hospital.update({
      where: { id: req.params.id },
      data: { isActive: false, status: 'suspended' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Platform suspend error:', err);
    res.status(500).json({ error: 'Failed to suspend hospital' });
  }
});

// ============================================================
// PATCH /api/platform/hospitals/:id/reactivate
// ============================================================
router.patch('/hospitals/:id/reactivate', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    await prisma.hospital.update({
      where: { id: req.params.id },
      data: { isActive: true, status: 'active' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Platform reactivate error:', err);
    res.status(500).json({ error: 'Failed to reactivate hospital' });
  }
});

// ============================================================
// POST /api/platform/backfill-permissions
// Recreates the canonical 20-role permission matrix for every hospital.
// Use this once after updating the permission template, or if any
// hospital's permissions look broken.
// ============================================================
router.post('/backfill-permissions', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      select: { id: true, name: true },
    });

    const results = [];

    for (const h of hospitals) {
      // 1) Wipe existing permissions for this hospital
      await prisma.rolePermission.deleteMany({ where: { tenantId: h.id } });

      // 2) Recreate using the shared helper inside a transaction
      const created = await prisma.$transaction(async (tx) => {
        return await createDefaultRolePermissions(tx, h.id);
      });

      results.push({
        hospital: h.name,
        tenantId: h.id,
        rolesCreated: created,
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('❌ Backfill permissions error:', err);
    res.status(500).json({
      error: 'Failed to backfill permissions',
      details: err.message,
    });
  }
});

// ============================================================
// POST /api/platform/backfill-starter-data
// Recreates clinics/wards/departments/services/configs for every hospital.
// Use this once after updating hospital-templates.js, or if any
// hospital is missing its starter data.
// ============================================================
router.post('/backfill-starter-data', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      select: { id: true, name: true },
    });

    const results = [];

    for (const h of hospitals) {
      // Wipe existing starter data for idempotent reseed
      await prisma.clinic.deleteMany({ where: { tenantId: h.id } });
      await prisma.ward.deleteMany({ where: { tenantId: h.id } });
      await prisma.department.deleteMany({ where: { tenantId: h.id } });
      await prisma.servicePricing.deleteMany({ where: { tenantId: h.id } });
      await prisma.serviceConfiguration.deleteMany({ where: { tenantId: h.id } });

      const created = await prisma.$transaction(async (tx) => {
        return await createDefaultHospitalData(tx, h.id);
      });

      results.push({
        hospital: h.name,
        tenantId: h.id,
        ...created, // clinics, wards, departments, services, configs
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('❌ Backfill starter data error:', err);
    res.status(500).json({
      error: 'Failed to backfill starter data',
      details: err.message,
    });
  }
});

// ============================================================
// GET /api/platform/users — list platform users
// ============================================================
router.get('/users', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    const users = await prisma.platformUser.findMany({
      select: {
        id: true, username: true, email: true,
        firstName: true, lastName: true, role: true,
        isActive: true, lastLogin: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    console.error('❌ List platform users error:', err);
    res.status(500).json({ error: 'Failed to load platform users' });
  }
});

// ============================================================
// POST /api/platform/users — create platform user
// ============================================================
router.post('/users', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const allowedRoles = ['PlatformAdmin', 'PlatformSupport', 'PlatformBilling'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        error: `Role must be one of: ${allowedRoles.join(', ')}`,
      });
    }

    const existing = await prisma.platformUser.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: email.toLowerCase() },
        ],
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.platformUser.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: hashed,
        firstName,
        lastName,
        role: role || 'PlatformSupport',
        isActive: true,
      },
      select: {
        id: true, username: true, email: true,
        firstName: true, lastName: true, role: true,
        isActive: true, createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error('❌ Create platform user error:', err);
    res.status(500).json({ error: 'Failed to create platform user' });
  }
});

// ============================================================
// PATCH /api/platform/users/:id — update role / active status
// ============================================================
router.patch('/users/:id', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    const { firstName, lastName, role, isActive } = req.body;

    // Prevent self-demotion or self-deactivation
    if (req.params.id === req.platformUser.id) {
      if (role && role !== 'PlatformAdmin') {
        return res.status(400).json({ error: 'You cannot change your own role' });
      }
      if (isActive === false) {
        return res.status(400).json({ error: 'You cannot deactivate yourself' });
      }
    }

    // If a role is being changed, validate it
    if (role !== undefined) {
      const allowedRoles = ['PlatformAdmin', 'PlatformSupport', 'PlatformBilling'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          error: `Role must be one of: ${allowedRoles.join(', ')}`,
        });
      }
    }

    const user = await prisma.platformUser.update({
      where: { id: req.params.id },
      data: {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        role: role !== undefined ? role : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      select: {
        id: true, username: true, email: true,
        firstName: true, lastName: true, role: true, isActive: true,
      },
    });

    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Platform user not found' });
    }
    console.error('❌ Update platform user error:', err);
    res.status(500).json({ error: 'Failed to update platform user' });
  }
});

// ============================================================
// POST /api/platform/users/:id/reset-password
// ============================================================
router.post('/users/:id/reset-password', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.platformUser.update({
      where: { id: req.params.id },
      data: { password: hashed },
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Platform user not found' });
    }
    console.error('❌ Reset platform password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ============================================================
// DELETE /api/platform/users/:id — remove a platform user
// ============================================================
router.delete('/users/:id', authenticatePlatform, requirePlatformAdmin, async (req, res) => {
  try {
    if (req.params.id === req.platformUser.id) {
      return res.status(400).json({ error: 'You cannot delete yourself' });
    }

    await prisma.platformUser.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Platform user deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Platform user not found' });
    }
    console.error('❌ Delete platform user error:', err);
    res.status(500).json({ error: 'Failed to delete platform user' });
  }
});

module.exports = router;