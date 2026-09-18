// src/routes/platform.js
require('dotenv').config();   // ← ADD THIS LINE FIRST

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma-client');

const JWT_SECRET = process.env.JWT_SECRET;   // now populated
const SALT_ROUNDS = 10;

// ────────────────────────────────────────────────────────────
// POST /api/platform/login — Platform user login
// ────────────────────────────────────────────────────────────
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

    // Update last login
    await prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // JWT — note: NO tenantId. This is a platform-level token.
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        scope: 'platform',  // ← important: identifies this as a platform token
      },
      JWT_SECRET,
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

// ────────────────────────────────────────────────────────────
// Middleware: authenticate + require platform scope
// ────────────────────────────────────────────────────────────
const authenticatePlatform = (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    // Reject tenant tokens
    if (payload.scope !== 'platform') {
      return res.status(403).json({ error: 'Platform access required' });
    }

    req.platformUser = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/platform/me — current platform user
// ────────────────────────────────────────────────────────────
router.get('/me', authenticatePlatform, async (req, res) => {
  const user = await prisma.platformUser.findUnique({
    where: { id: req.platformUser.id },
    select: {
      id: true, username: true, email: true,
      firstName: true, lastName: true, role: true,
      lastLogin: true,
    },
  });
  res.json(user);
});

// ────────────────────────────────────────────────────────────
// GET /api/platform/hospitals — list all hospitals
// ────────────────────────────────────────────────────────────
router.get('/hospitals', authenticatePlatform, async (req, res) => {
  const hospitals = await prisma.hospital.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { Staff: true, Patient: true } },
    },
  });
  res.json(hospitals);
});

// ────────────────────────────────────────────────────────────
// GET /api/platform/stats — platform-wide stats
// ────────────────────────────────────────────────────────────
router.get('/stats', authenticatePlatform, async (req, res) => {
  const [totalHospitals, activeHospitals, totalStaff, totalPatients] = await Promise.all([
    prisma.hospital.count(),
    prisma.hospital.count({ where: { isActive: true } }),
    prisma.staff.count(),
    prisma.patient.count(),
  ]);
  res.json({ totalHospitals, activeHospitals, totalStaff, totalPatients });
});

// ────────────────────────────────────────────────────────────
// PATCH /api/platform/hospitals/:id/suspend
// ────────────────────────────────────────────────────────────
router.patch('/hospitals/:id/suspend', authenticatePlatform, async (req, res) => {
  await prisma.hospital.update({
    where: { id: req.params.id },
    data: { isActive: false, status: 'suspended' },
  });
  res.json({ success: true });
});

// ────────────────────────────────────────────────────────────
// PATCH /api/platform/hospitals/:id/reactivate
// ────────────────────────────────────────────────────────────
router.patch('/hospitals/:id/reactivate', authenticatePlatform, async (req, res) => {
  await prisma.hospital.update({
    where: { id: req.params.id },
    data: { isActive: true, status: 'active' },
  });
  res.json({ success: true });
});

module.exports = router;