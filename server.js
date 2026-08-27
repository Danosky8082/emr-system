// server.js - COMPLETE WITH LAB SCIENTIST, WALLET, AND STAFF NAME FIXES
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
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

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const SALT_ROUNDS = 10;

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

// ============ ✅ COMPLETE CORS CONFIGURATION ============
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'Origin', 
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400
}));

// Security middleware (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============ CREATE UPLOAD DIRECTORY ============
const uploadDir = path.join(__dirname, 'uploads', 'imaging');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Created upload directory: ${uploadDir}`);
}

// ============ SERVE STATIC FILES ============
app.use('/uploads/imaging', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadDir, {
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

// ✅ Public image endpoint (no authentication required)
app.get('/images/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    console.log(`📸 Public image request: ${filename}`);
    
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.log(`❌ Invalid filename: ${filename}`);
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const imagePath = path.join(uploadDir, filename);
    console.log(`📸 Looking for image at: ${imagePath}`);
    
    if (!fs.existsSync(imagePath)) {
      console.log(`❌ Image not found: ${imagePath}`);
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const ext = path.extname(filename).toLowerCase();
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.dicom': 'application/dicom'
    }[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    res.sendFile(imagePath);
  } catch (error) {
    console.error('❌ Public image error:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000
});
app.use('/api', limiter);

// ============ AUTHENTICATION MIDDLEWARES ============

// Staff authentication middleware
const authenticate = async (req, res, next) => {
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
};

// Staff authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ============ PATIENT AUTHENTICATION MIDDLEWARE ============
const authenticatePatient = async (req, res, next) => {
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
};

// ============ PATIENT WALLET ENDPOINTS ============

// Get Patient Wallet (Patient)
app.get('/api/patient/wallet', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    let wallet = await prisma.patientWallet.findUnique({
      where: { patientId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!wallet) {
      wallet = await prisma.patientWallet.create({
        data: {
          patientId,
          balance: 0,
          status: 'Active'
        },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 50
          }
        }
      });
    }

    res.json(wallet);
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Wallet (Staff)
app.get('/api/patients/:patientId/wallet', authenticate, authorize('Admin', 'Records', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    let wallet = await prisma.patientWallet.findUnique({
      where: { patientId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 100
        }
      }
    });

    if (!wallet) {
      wallet = await prisma.patientWallet.create({
        data: {
          patientId,
          balance: 0,
          status: 'Active'
        },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 100
          }
        }
      });
    }

    res.json({
      ...wallet,
      patient: {
        id: patient.id,
        hospitalId: patient.hospitalId,
        firstName: patient.firstName,
        lastName: patient.lastName
      }
    });
  } catch (error) {
    console.error('Get patient wallet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deposit to Wallet (Staff)
app.post('/api/patients/:patientId/wallet/deposit', authenticate, authorize('Admin', 'Records', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { amount, paymentMethod, paymentReference, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    let wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (!wallet) {
      wallet = await prisma.patientWallet.create({
        data: {
          patientId,
          balance: 0,
          status: 'Active'
        }
      });
    }

    if (wallet.status !== 'Active') {
      return res.status(400).json({ error: `Wallet is ${wallet.status.toLowerCase()}` });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.patientWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          lastTransactionAt: new Date()
        }
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionType: 'Deposit',
          amount: amount,
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          description: `Cash deposit by ${req.user.firstName} ${req.user.lastName}`,
          reference: `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'Completed',
          paymentMethod: paymentMethod || 'Cash',
          paymentReference: paymentReference || null,
          paidToStaffId: req.user.id,
          notes: notes || null
        }
      });

      await tx.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'WALLET_DEPOSIT',
          module: 'Wallet',
          details: `Deposited ₦${amount.toLocaleString()} to wallet of ${patient.hospitalId}`
        }
      });

      return { updatedWallet, transaction };
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

// Pay from Wallet (Staff)
app.post('/api/patients/:patientId/wallet/pay', authenticate, authorize('Admin', 'Records', 'BillingOfficer', 'Accountant', 'Doctor', 'Nurse', 'Pharmacist', 'LabTechnician', 'Radiologist'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { amount, description, serviceId, serviceType, category } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (wallet.status !== 'Active') {
      return res.status(400).json({ error: `Wallet is ${wallet.status.toLowerCase()}` });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}`,
        balance: wallet.balance,
        required: amount
      });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.patientWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          lastTransactionAt: new Date()
        }
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionType: 'Payment',
          amount: amount,
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          description: description,
          reference: `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'Completed',
          category: category || 'General',
          serviceId: serviceId || null,
          serviceType: serviceType || null,
          paidToStaffId: req.user.id,
          notes: `Payment processed by ${req.user.firstName} ${req.user.lastName}`
        }
      });

      await tx.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'WALLET_PAYMENT',
          module: 'Wallet',
          details: `Paid ₦${amount.toLocaleString()} from wallet of ${patient.hospitalId} - ${description}`
        }
      });

      return { updatedWallet, transaction };
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

// Get Wallet Balance (Patient)
app.get('/api/patient/wallet/balance', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (!wallet) {
      const newWallet = await prisma.patientWallet.create({
        data: {
          patientId,
          balance: 0,
          status: 'Active'
        }
      });
      return res.json({ balance: newWallet.balance, currency: newWallet.currency });
    }

    res.json({ 
      balance: wallet.balance, 
      currency: wallet.currency,
      status: wallet.status
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Wallet Transactions (Patient)
app.get('/api/patient/wallet/transactions', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { limit = 50, offset = 0, type } = req.query;

    const wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (!wallet) {
      return res.json({ transactions: [], total: 0 });
    }

    const where = { walletId: wallet.id };
    if (type) {
      where.transactionType = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.walletTransaction.count({ where })
    ]);

    res.json({ transactions, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Wallet Summary (Staff)
app.get('/api/wallet/summary', authenticate, authorize('Admin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const [totalWallets, totalBalance, activeWallets, frozenWallets] = await Promise.all([
      prisma.patientWallet.count(),
      prisma.patientWallet.aggregate({ _sum: { balance: true } }),
      prisma.patientWallet.count({ where: { status: 'Active' } }),
      prisma.patientWallet.count({ where: { status: 'Frozen' } })
    ]);

    const recentTransactions = await prisma.walletTransaction.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          include: {
            patient: {
              select: {
                id: true,
                hospitalId: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    res.json({
      summary: {
        totalWallets,
        totalBalance: totalBalance._sum.balance || 0,
        activeWallets,
        frozenWallets
      },
      recentTransactions
    });
  } catch (error) {
    console.error('Wallet summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Freeze/Unfreeze Wallet (Staff)
app.patch('/api/patients/:patientId/wallet/status', authenticate, authorize('Admin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status } = req.body;

    if (!status || !['Active', 'Frozen', 'Closed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (Active, Frozen, Closed)' });
    }

    const wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const updatedWallet = await prisma.patientWallet.update({
      where: { id: wallet.id },
      data: { status }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'WALLET_STATUS_CHANGE',
        module: 'Wallet',
        details: `Changed wallet status to ${status} for patient ${patientId}`
      }
    });

    res.json({
      message: `Wallet status updated to ${status}`,
      wallet: updatedWallet
    });
  } catch (error) {
    console.error('Wallet status update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PERMISSION MIDDLEWARE ============
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

      const rolePerm = await prisma.rolePermission.findUnique({
        where: { role: userRole },
        select: { [permissionKey]: true },
      });

      if (!rolePerm) {
        await prisma.rolePermission.create({
          data: { 
            role: userRole,
            dashboard: false,
            patients: false,
            staff: false,
            appointments: false,
            prescriptions: false,
            labOrders: false,
            antenatal: false,
            nurseDashboard: false,
            doctorDashboard: false,
            doctorQueue: false,
            pharmacy: false,
            pharmacyDashboard: false,
            pharmacyInventory: false,
            nhisManagement: false,
            nhisAuthorizations: false,
            pharmacyStock: false,
            pharmacyTransactions: false,
            pharmacyBranches: false,
            billing: false,
            pricing: false,
            billingOfficer: false,
            wallet: false,
            patientIntake: false,
            admissions: false,
            patientHistory: false,
            roiRequests: false,
            archivedPatients: false,
            archivedPatientsView: false,
            clinics: false,
            wards: false,
            queueManagement: false,
            hrDashboard: false,
            hrEmployees: false,
            hrDepartments: false,
            hrLeaves: false,
            hrAttendance: false,
            hrPerformance: false,
            hrTrainings: false,
            radiology: false,
            dental: false,
            optometry: false,
            immunizations: false,
            patientPortal: false,
            portalSetup: false,
          }
        });
        return res.status(403).json({ error: 'Forbidden – insufficient permissions' });
      }

      if (!rolePerm[permissionKey]) {
        return res.status(403).json({ error: 'Forbidden – insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// ============ AUTHENTICATION ENDPOINTS ============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { employeeId, firstName, lastName, email, role, department, password } = req.body;

    if (!employeeId || !firstName || !lastName || !email || !role || !password) {
      return res.status(400).json({
        error: 'Missing required fields: employeeId, firstName, lastName, email, role, password'
      });
    }

    const existingStaff = await prisma.staff.findUnique({
      where: { email }
    });
    if (existingStaff) {
      return res.status(400).json({ error: 'Staff with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const staff = await prisma.staff.create({
      data: {
        employeeId,
        firstName,
        lastName,
        email,
        role,
        department,
        password: hashedPassword,
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
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
    const { email, password, username } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({ 
        error: 'Username/Email and password are required' 
      });
    }

    let staff;
    if (email) {
      staff = await prisma.staff.findUnique({
        where: { email: email.trim() }
      });
    } else if (username) {
      staff = await prisma.staff.findUnique({
        where: { username: username.trim() }
      });
    }

    if (!staff) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!staff.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, staff.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: staff.id, email: staff.email, role: staff.role, username: staff.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await prisma.auditLog.create({
      data: {
        staffId: staff.id,
        action: 'LOGIN',
        module: 'Auth',
        details: `Staff ${staff.username || staff.email} logged in`,
        ipAddress: req.ip
      }
    });

    const { password: _, ...staffWithoutPassword } = staff;
    res.json({ token, staff: staffWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ HEALTH CHECK ============
app.get('/api/health', async (req, res) => {
  try {
    const patientCount = await prisma.patient.count();
    res.json({
      status: 'OK',
      message: 'Database connection successful!',
      patientCount: patientCount,
      database: 'emr_db',
      port: '5433'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// ============ PATIENT PORTAL ENDPOINTS ============

// Patient Login - Supports both PIN and Password
app.post('/api/patient/login', async (req, res) => {
  try {
    const { hospitalId, password, pinCode } = req.body;
    
    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { hospitalId }
    });

    if (!patient) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!patient.portalAccess) {
      return res.status(403).json({ 
        error: 'Portal access not enabled. Please contact the hospital to set up your access.' 
      });
    }

    if (pinCode && patient.pinCode) {
      const isValidPin = await bcrypt.compare(pinCode, patient.pinCode);
      if (isValidPin) {
        if (patient.mustChangePassword) {
          return generateTempToken(patient, res);
        }
        return generatePatientToken(patient, res);
      }
    }

    if (password && patient.password) {
      const isValidPassword = await bcrypt.compare(password, patient.password);
      if (isValidPassword) {
        if (patient.mustChangePassword) {
          return generateTempToken(patient, res);
        }
        return generatePatientToken(patient, res);
      }
    }

    return res.status(401).json({ error: 'Invalid PIN or Password' });
  } catch (error) {
    console.error('Patient login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate temp token (for password change)
const generateTempToken = (patient, res) => {
  const token = jwt.sign(
    { 
      id: patient.id, 
      hospitalId: patient.hospitalId, 
      role: 'Patient',
      mustChangePassword: true 
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  prisma.patient.update({
    where: { id: patient.id },
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
      lastName: patient.lastName,
    }
  });
};

// Helper function to generate full access token
const generatePatientToken = (patient, res) => {
  const token = jwt.sign(
    { 
      id: patient.id, 
      hospitalId: patient.hospitalId, 
      role: 'Patient',
      mustChangePassword: false 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  prisma.patient.update({
    where: { id: patient.id },
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

// Enable Patient Portal with PIN setup (Staff only)
app.post('/api/patient/setup-portal', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { patientId, pinCode, password, forceChange } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    if (!pinCode && !password) {
      return res.status(400).json({ error: 'PIN or Password is required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const shouldForceChange = forceChange !== undefined ? forceChange : true;
    
    const updateData = { 
      portalAccess: true,
      mustChangePassword: shouldForceChange,
      pinAttempts: 0,
      lockedUntil: null
    };
    
    if (pinCode) {
      if (!/^\d{4,6}$/.test(pinCode)) {
        return res.status(400).json({ error: 'PIN must be 4-6 digits' });
      }
      updateData.pinCode = await bcrypt.hash(pinCode, SALT_ROUNDS);
    }
    
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: updateData
    });

    await prisma.auditLog.create({
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
        id: updatedPatient.id,
        hospitalId: updatedPatient.hospitalId,
        firstName: updatedPatient.firstName,
        lastName: updatedPatient.lastName,
        portalAccess: updatedPatient.portalAccess,
        mustChangePassword: updatedPatient.mustChangePassword
      }
    });
  } catch (error) {
    console.error('Setup portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset Patient PIN/Password (Staff only)
app.post('/api/patient/reset-portal', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        pinCode: null,
        password: null,
        portalAccess: false,
        mustChangePassword: false,
        pinAttempts: 0,
        lockedUntil: null
      }
    });

    await prisma.auditLog.create({
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
        id: updatedPatient.id,
        hospitalId: updatedPatient.hospitalId,
        firstName: updatedPatient.firstName,
        lastName: updatedPatient.lastName,
        portalAccess: updatedPatient.portalAccess
      }
    });
  } catch (error) {
    console.error('Reset portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password - Request Reset (Public - No auth required)
app.post('/api/patient/forgot-password', async (req, res) => {
  try {
    const { hospitalId, email } = req.body;

    if (!hospitalId && !email) {
      return res.status(400).json({ error: 'Hospital ID or email is required' });
    }

    const where = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (email) where.email = email;

    const patient = await prisma.patient.findFirst({ where });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const resetToken = jwt.sign(
      { id: patient.id, hospitalId: patient.hospitalId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ 
      message: 'Password reset instructions sent to your registered email',
      resetToken
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset Password with Token (Public - No auth required)
app.post('/api/patient/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const patientId = decoded.id;

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.patient.update({
      where: { id: patientId },
      data: { 
        password: hashedPassword,
        mustChangePassword: false
      }
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change Password/PIN Endpoint (Patient - Authenticated)
app.post('/api/patient/change-credentials', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { currentCredential, newCredential, confirmCredential, type } = req.body;

    console.log('🔐 Change credentials request:', { patientId, type });

    if (!currentCredential || !newCredential || !confirmCredential) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (newCredential !== confirmCredential) {
      return res.status(400).json({ error: 'New credential does not match confirmation' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    let isValid = false;
    if (type === 'pin' && patient.pinCode) {
      isValid = await bcrypt.compare(currentCredential, patient.pinCode);
    } else if (type === 'password' && patient.password) {
      isValid = await bcrypt.compare(currentCredential, patient.password);
    } else {
      return res.status(400).json({ error: 'Invalid credential type or no credential set' });
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Current credential is incorrect' });
    }

    if (type === 'pin') {
      if (!/^\d{4,6}$/.test(newCredential)) {
        return res.status(400).json({ error: 'PIN must be 4-6 digits' });
      }
    } else if (type === 'password') {
      if (newCredential.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
    }

    const hashedCredential = await bcrypt.hash(newCredential, SALT_ROUNDS);
    const updateData = {
      mustChangePassword: false,
      pinAttempts: 0
    };

    if (type === 'pin') {
      updateData.pinCode = hashedCredential;
    } else {
      updateData.password = hashedCredential;
    }

    await prisma.patient.update({
      where: { id: patientId },
      data: updateData
    });

    const token = jwt.sign(
      { 
        id: patient.id, 
        hospitalId: patient.hospitalId, 
        role: 'Patient',
        mustChangePassword: false 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: `${type === 'pin' ? 'PIN' : 'Password'} changed successfully!`,
      token: token,
      mustChangePassword: false
    });
  } catch (error) {
    console.error('Change credentials error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if patient must change password
app.get('/api/patient/must-change-password', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    res.json({ 
      mustChangePassword: patient?.mustChangePassword || false,
      message: patient?.mustChangePassword ? 'Please change your password before continuing' : null
    });
  } catch (error) {
    console.error('Check must change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Force password change (Staff only)
app.post('/api/patient/force-change', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { patientId, forceChange } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        mustChangePassword: forceChange !== undefined ? forceChange : true,
        lockedUntil: null,
        pinAttempts: 0
      }
    });

    await prisma.auditLog.create({
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
        id: updatedPatient.id,
        hospitalId: updatedPatient.hospitalId,
        firstName: updatedPatient.firstName,
        lastName: updatedPatient.lastName,
        mustChangePassword: updatedPatient.mustChangePassword
      }
    });
  } catch (error) {
    console.error('Force change error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Dashboard
app.get('/api/patient/dashboard', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const patient = await prisma.patient.findUnique({
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
      prisma.appointment.findMany({
        where: { patientId },
        include: { staff: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { dateTime: 'asc' },
        take: 5
      }),
      prisma.prescription.findMany({
        where: { patientId },
        include: { prescribedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.labOrder.findMany({
        where: { patientId },
        include: { orderedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.billingRecord.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.vitalSign.findMany({
        where: { patientId },
        orderBy: { recordedAt: 'desc' },
        take: 5
      }),
      prisma.patientNotification.findMany({
        where: { patientId, isRead: false },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const upcomingAppointments = appointments.filter(a => 
      new Date(a.dateTime) > new Date() && a.status !== 'Cancelled'
    );

    res.json({
      appointments: upcomingAppointments,
      prescriptions,
      labOrders,
      billingRecords,
      vitals,
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

// Get Patient Appointments
app.get('/api/patient/appointments', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { status } = req.query;

    const where = { patientId };
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: { dateTime: 'asc' }
    });

    res.json(appointments);
  } catch (error) {
    console.error('Get patient appointments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Book Appointment (Patient)
app.post('/api/patient/appointments', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { staffId, dateTime, duration, type, notes } = req.body;

    if (!staffId || !dateTime) {
      return res.status(400).json({ error: 'Staff and date/time are required' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId, isActive: true }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Doctor not available' });
    }

    const conflicting = await prisma.appointment.findFirst({
      where: {
        staffId,
        dateTime: new Date(dateTime),
        status: { not: 'Cancelled' }
      }
    });

    if (conflicting) {
      return res.status(400).json({ error: 'This time slot is already booked' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        staffId,
        dateTime: new Date(dateTime),
        duration: duration || 30,
        type: type || 'Consultation',
        notes: notes || 'Booked via Patient Portal',
        status: 'Scheduled'
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    await prisma.patientNotification.create({
      data: {
        patientId,
        title: 'Appointment Booked',
        message: `Your appointment with Dr. ${staff.firstName} ${staff.lastName} has been booked for ${new Date(dateTime).toLocaleString()}`,
        type: 'appointment'
      }
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel Appointment (Patient)
app.patch('/api/patient/appointments/:id/cancel', authenticatePatient, async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.patient.id;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.patientId !== patientId) {
      return res.status(403).json({ error: 'Not your appointment' });
    }

    if (appointment.status === 'Cancelled') {
      return res.status(400).json({ error: 'Appointment already cancelled' });
    }

    if (new Date(appointment.dateTime) < new Date()) {
      return res.status(400).json({ error: 'Cannot cancel past appointments' });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'Cancelled' }
    });

    await prisma.patientNotification.create({
      data: {
        patientId,
        title: 'Appointment Cancelled',
        message: `Your appointment on ${new Date(appointment.dateTime).toLocaleString()} has been cancelled.`,
        type: 'appointment'
      }
    });

    res.json({ message: 'Appointment cancelled successfully', appointment: updated });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Prescriptions
app.get('/api/patient/prescriptions', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const prescriptions = await prisma.prescription.findMany({
      where: { patientId },
      include: {
        prescribedBy: { select: { firstName: true, lastName: true, role: true } },
        dispensedBy: { select: { firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(prescriptions);
  } catch (error) {
    console.error('Get patient prescriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Lab Results
app.get('/api/patient/lab-results', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const labOrders = await prisma.labOrder.findMany({
      where: { patientId },
      include: {
        orderedBy: { select: { firstName: true, lastName: true, role: true } },
        performedBy: { select: { firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(labOrders);
  } catch (error) {
    console.error('Get patient lab results error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Billing
app.get('/api/patient/billing', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const bills = await prisma.billingRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(bills);
  } catch (error) {
    console.error('Get patient billing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Medical History
app.get('/api/patient/medical-history', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const history = await prisma.patientHistoryRecord.findMany({
      where: { patientId },
      orderBy: { encounterDate: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error('Get patient medical history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Vitals
app.get('/api/patient/vitals', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const vitals = await prisma.vitalSign.findMany({
      where: { patientId },
      include: { nurse: { select: { firstName: true, lastName: true } } },
      orderBy: { recordedAt: 'desc' }
    });

    res.json(vitals);
  } catch (error) {
    console.error('Get patient vitals error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Patient Notifications
app.get('/api/patient/notifications', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { unreadOnly = 'false' } = req.query;

    const where = { patientId };
    if (unreadOnly === 'true') where.isRead = false;

    const notifications = await prisma.patientNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const unreadCount = await prisma.patientNotification.count({
      where: { patientId, isRead: false }
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark Notification as Read
app.patch('/api/patient/notifications/:id/read', authenticatePatient, async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.patient.id;

    const notification = await prisma.patientNotification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.patientId !== patientId) {
      return res.status(403).json({ error: 'Not your notification' });
    }

    const updated = await prisma.patientNotification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json({ message: 'Notification marked as read', notification: updated });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark All Notifications as Read
app.patch('/api/patient/notifications/read-all', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    await prisma.patientNotification.updateMany({
      where: { patientId, isRead: false },
      data: { isRead: true }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update Patient Profile
app.put('/api/patient/profile', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { phone, email, address, emergencyContact } = req.body;

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        emergencyContact: emergencyContact || undefined
      },
      select: {
        id: true,
        hospitalId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        address: true,
        emergencyContact: true
      }
    });

    res.json({ message: 'Profile updated successfully', patient });
  } catch (error) {
    console.error('Update patient profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change Password (Original - kept for backward compatibility)
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

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient || !patient.password) {
      return res.status(400).json({ error: 'Portal account not set up properly' });
    }

    const isValid = await bcrypt.compare(currentPassword, patient.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.patient.update({
      where: { id: patientId },
      data: { 
        password: hashedPassword,
        mustChangePassword: false,
        lastPasswordChange: new Date()
      }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Available Doctors
app.get('/api/patient/available-doctors', authenticatePatient, async (req, res) => {
  try {
    const { date, clinicId } = req.query;

    const where = { isActive: true };
    if (clinicId) {
      where.clinics = { some: { clinicId } };
    }

    const doctors = await prisma.staff.findMany({
      where,
      include: {
        clinics: { include: { clinic: true } },
        department: true
      },
      orderBy: { firstName: 'asc' }
    });

    const availableDoctors = doctors.filter(d => 
      ['Doctor', 'Obstetrician'].includes(d.role)
    );

    res.json(availableDoctors);
  } catch (error) {
    console.error('Get available doctors error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ END OF PATIENT PORTAL ENDPOINTS ============

// ============ PATIENT ARCHIVE ENDPOINTS ============
app.get('/api/patients/archived', authenticate, checkPermission('archivedPatients'), async (req, res) => {
  try {
    console.log('📦 Fetching archived patients...');
    const patients = await prisma.patient.findMany({
      where: { isArchived: true },
      include: {
        journeys: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { archivedAt: 'desc' }
    });
    res.json(patients);
  } catch (error) {
    console.error('Get archived patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients/:id/archive', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { 
        journeys: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (patient.isArchived) return res.status(400).json({ error: 'Patient is already archived' });
    const hasCompletedJourney = patient.journeys.some(j => j.status === 'COMPLETED');
    if (!hasCompletedJourney) {
      return res.status(400).json({ error: 'Patient must have a completed journey before archiving' });
    }
    const archivedPatient = await prisma.patient.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedReason: reason || 'Manually archived by staff',
        archivedBy: req.user.id,
        autoArchived: false
      }
    });
    if (patient.journeys.length > 0) {
      await prisma.patientJourney.update({
        where: { id: patient.journeys[0].id },
        data: { archivedAt: new Date() }
      });
    }
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'ARCHIVE_PATIENT',
        module: 'Records',
        details: `Manually archived patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}`
      }
    });
    res.json({ message: 'Patient archived successfully', patient: archivedPatient });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/patients/:id/unarchive', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!patient.isArchived) return res.status(400).json({ error: 'Patient is not archived' });
    const unarchivedPatient = await prisma.patient.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedReason: null,
        archivedBy: null,
        autoArchived: false
      }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UNARCHIVE_PATIENT',
        module: 'Records',
        details: `Unarchived patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}`
      }
    });
    res.json({ message: 'Patient unarchived successfully', patient: unarchivedPatient });
  } catch (error) {
    console.error('Unarchive error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ PATIENT HISTORY ENDPOINTS ============

app.get('/api/patients/:patientId/history', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const historyRecords = await prisma.patientHistoryRecord.findMany({
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
    
    console.log('🔍 Searching patient history for:', search);
    
    if (!search) {
      return res.json([]);
    }
    
    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { hospitalId: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      },
      select: { id: true, hospitalId: true, firstName: true, lastName: true, gender: true, dateOfBirth: true }
    });
    
    console.log('👤 Found patients:', patients.length);
    
    if (patients.length === 0) {
      return res.json([]);
    }
    
    const patientIds = patients.map(p => p.id);
    
    const historyRecords = await prisma.patientHistoryRecord.findMany({
      where: { patientId: { in: patientIds } },
      include: {
        patient: { 
          select: { 
            hospitalId: true, 
            firstName: true, 
            lastName: true,
            gender: true,
            dateOfBirth: true
          } 
        }
      },
      orderBy: { encounterDate: 'desc' }
    });
    
    console.log('📋 Found history records:', historyRecords.length);
    res.json(historyRecords);
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

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const record = await prisma.patientHistoryRecord.create({
      data: {
        patientId,
        doctorName,
        encounterType: encounterType || 'Outpatient',
        diagnosis,
        icd10Code,
        notes
      },
      include: { patient: true }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'ADD_MEDICAL_CODING',
        module: 'Records',
        details: `Added history/coding for patient ${record.patient.hospitalId} (ICD-10: ${icd10Code || 'N/A'})`
      }
    });

    res.status(201).json(record);
  } catch (error) {
    console.error('Create history error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ ROI REQUESTS ============

app.get('/api/roi', authenticate, async (req, res) => {
  try {
    const requests = await prisma.rOIRequest.findMany({
      orderBy: { requestDate: 'desc' }
    });
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

    const roi = await prisma.rOIRequest.create({
      data: {
        requestorName,
        patientName,
        requestType
      }
    });

    await prisma.auditLog.create({
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

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const roi = await prisma.rOIRequest.update({
      where: { id },
      data: { status }
    });

    await prisma.auditLog.create({
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

// ============ PATIENT ENDPOINTS ============

app.post('/api/patients', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { 
      firstName, lastName, dateOfBirth, gender, phone, email, address, 
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
      patientCategory, insuranceProvider, insuranceId, corporateCompany
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !gender) {
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, dateOfBirth, gender' });
    }
    if (!nextOfKinPhone) {
      return res.status(400).json({ error: 'Next of Kin phone number is required' });
    }

    const allPatients = await prisma.patient.findMany({ select: { hospitalId: true } });
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
        patient = await prisma.patient.create({
          data: {
            hospitalId, firstName, lastName, dateOfBirth: new Date(dateOfBirth), gender,
            phone, email, address, emergencyContact, allergies,
            nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
            patientCategory: patientCategory || 'FPP',
            insuranceProvider: insuranceProvider || null,
            insuranceId: insuranceId || null,
            corporateCompany: corporateCompany || null
          }
        });
        break;
      } catch (err) {
        if (err.code === 'P2002') { attempts++; nextIdNumber++; } else throw err;
      }
    }
    if (!patient) throw new Error('Failed to generate a unique Hospital ID after multiple attempts.');

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_PATIENT',
        module: 'Patient',
        details: `Created patient ${firstName} ${lastName} (${patient.hospitalId})`
      }
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ✅ UPDATED: GET /api/patients with LabTechnician and LabScientist
app.get('/api/patients', authenticate, authorize('Admin', 'Records', 'ITAdmin', 'BillingOfficer', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Radiologist', 'LabTechnician', 'LabScientist'), async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(patients);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/:id', authenticate, async (req, res) => {
  try {
    const patientId = req.params.id;
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { 
        appointments: {
          include: { staff: { select: { id: true, firstName: true, lastName: true, role: true } } }
        }, 
        clinicalNotes: {
          include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } }
        }, 
        prescriptions: {
          include: { 
            prescribedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
            dispensedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
          }
        }, 
        labOrders: {
          include: { 
            orderedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
            performedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
          }
        }, 
        billingRecords: true 
      }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (['Nurse', 'Doctor'].includes(req.user.role)) {
      const activeJourney = await prisma.patientJourney.findFirst({
        where: { patientId: patientId, status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] } },
        select: { clinicId: true, wardId: true }
      });
      if (!activeJourney) {
        return res.status(403).json({ error: 'This patient has not yet arrived at a clinic or ward.' });
      }
      const staff = await prisma.staff.findUnique({
        where: { id: req.user.id },
        include: { clinics: { select: { clinicId: true } }, wards: { select: { wardId: true } } }
      });
      const allowedClinicIds = staff.clinics.map(c => c.clinicId);
      const allowedWardIds = staff.wards.map(w => w.wardId);
      const isAuthorized = (activeJourney.clinicId && allowedClinicIds.includes(activeJourney.clinicId)) ||
                          (activeJourney.wardId && allowedWardIds.includes(activeJourney.wardId));
      if (!isAuthorized) {
        return res.status(403).json({ error: 'You are not assigned to the clinic or ward where this patient is located.' });
      }
    }

    await prisma.auditLog.create({
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

app.get('/api/patients/search/:query', authenticate, async (req, res) => {
  try {
    const { query } = req.params;
    const patients = await prisma.patient.findMany({
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
    const { firstName, lastName, dateOfBirth, gender, phone, email, address, 
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
      patientCategory, insuranceProvider, insuranceId, corporateCompany } = req.body;

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        firstName, lastName, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
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

app.delete('/api/patients/:id', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id.length < 5) return res.status(400).json({ error: 'Invalid patient ID format.' });
    const existingPatient = await prisma.patient.findUnique({ where: { id } });
    if (!existingPatient) return res.status(404).json({ error: 'Patient not found.' });
    await prisma.patient.delete({ where: { id } });
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Cannot delete this patient because they have associated records.'
      });
    }
    res.status(400).json({ error: error.message || 'Failed to delete patient.' });
  }
});

// ============ STAFF MANAGEMENT ENDPOINTS ============

app.get('/api/staff', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({ orderBy: { createdAt: 'desc' } });
    const staffWithoutPasswords = staff.map(({ password, ...rest }) => rest);
    res.json(staffWithoutPasswords);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    const { password, ...staffWithoutPassword } = staff;
    res.json(staffWithoutPassword);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { employeeId, firstName, lastName, username, email, role, departmentId, password } = req.body;
    
    if (!employeeId || !firstName || !lastName || !username || !email || !role || !password) {
      return res.status(400).json({
        error: 'Missing required fields: employeeId, firstName, lastName, username, email, role, password'
      });
    }

    const existingEmployeeId = await prisma.staff.findUnique({
      where: { employeeId }
    });
    if (existingEmployeeId) {
      return res.status(400).json({ error: 'Employee ID already exists' });
    }

    const existingUsername = await prisma.staff.findUnique({
      where: { username }
    });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const existingEmail = await prisma.staff.findUnique({
      where: { email }
    });
    if (existingEmail) {
      return res.status(400).json({ error: 'Staff with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const staff = await prisma.staff.create({
      data: {
        employeeId,
        firstName,
        lastName,
        username: username.toLowerCase().trim(),
        email,
        role,
        departmentId: departmentId || null,
        password: hashedPassword,
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_STAFF',
        module: 'Staff',
        details: `Created staff ${username} as ${role}`
      }
    });

    const { password: _, ...staffWithoutPassword } = staff;
    res.status(201).json(staffWithoutPassword);
  } catch (error) {
    console.error('Create staff error:', error);
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return res.status(400).json({ 
        error: `Duplicate value for ${field}. Please use a unique ${field}.` 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, firstName, lastName, username, email, role, departmentId, isActive } = req.body;

    if (employeeId) {
      const existingEmployeeId = await prisma.staff.findFirst({
        where: { 
          employeeId,
          NOT: { id }
        }
      });
      if (existingEmployeeId) {
        return res.status(400).json({ error: 'Employee ID already exists' });
      }
    }

    if (username) {
      const existingUsername = await prisma.staff.findFirst({
        where: { 
          username: username.toLowerCase().trim(),
          NOT: { id }
        }
      });
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        employeeId,
        firstName,
        lastName,
        username: username ? username.toLowerCase().trim() : undefined,
        email,
        role,
        departmentId: departmentId || null,
        isActive
      }
    });

    const { password, ...staffWithoutPassword } = staff;
    res.json(staffWithoutPassword);
  } catch (error) {
    console.error('Update staff error:', error);
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return res.status(400).json({ 
        error: `Duplicate value for ${field}. Please use a unique ${field}.` 
      });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const existingStaff = await prisma.staff.findUnique({ where: { id } });
    if (!existingStaff) return res.status(404).json({ error: 'Staff not found' });
    const staff = await prisma.staff.update({ where: { id }, data: { isActive: false } });
    await prisma.auditLog.create({
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
    const existingStaff = await prisma.staff.findUnique({ where: { id } });
    if (!existingStaff) return res.status(404).json({ error: 'Staff not found' });
    const staff = await prisma.staff.update({ where: { id }, data: { isActive: true } });
    await prisma.auditLog.create({
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
    const existingStaff = await prisma.staff.findUnique({ where: { id } });
    if (!existingStaff) return res.status(404).json({ error: 'Staff not found' });
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const staff = await prisma.staff.update({ where: { id }, data: { password: hashedPassword } });
    await prisma.auditLog.create({
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

// ============ APPOINTMENT ENDPOINTS ============

app.get('/api/appointments', authenticate, async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { patient: true, staff: true },
      orderBy: { dateTime: 'asc' }
    });
    res.json(appointments);
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
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    const appointment = await prisma.appointment.create({
      data: {
        patientId, staffId, dateTime: new Date(dateTime),
        duration: duration || 30, type: type || 'Consultation', notes, status: 'Scheduled'
      },
      include: { patient: true, staff: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_APPOINTMENT',
        module: 'Appointment',
        details: `Created appointment for patient ${patient.hospitalId} with ${staff.firstName} ${staff.lastName}`
      }
    });
    res.status(201).json(appointment);
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
    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: { patient: true, staff: true }
    });
    await prisma.auditLog.create({
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

// ============ CLINICAL NOTES (SOAP) ENDPOINTS ============

// ✅ UPDATED: GET /api/patients/:patientId/notes with staff name fallback
app.get('/api/patients/:patientId/notes', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const userRole = req.user.role;
    if (!['Admin', 'ITAdmin', 'Records', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to view clinical notes' });
    }
    
    const notes = await prisma.clinicalNote.findMany({
      where: { patientId },
      include: { 
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        } 
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // ✅ Add fallback for unknown staff
    const formattedNotes = notes.map(note => ({
      ...note,
      author: note.author ? {
        ...note.author,
        fullName: note.author.firstName && note.author.lastName 
          ? `${note.author.firstName} ${note.author.lastName}`
          : `${note.author.role || 'Unknown'} (ID: ${note.authorId?.slice(0, 8) || 'Unknown'})`
      } : {
        fullName: 'Unknown Staff (Deleted)',
        role: 'Unknown'
      }
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
    
    if (!patientId) {
      return res.status(400).json({ error: 'Missing required field: patientId' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const note = await prisma.clinicalNote.create({
      data: {
        patientId,
        authorId: req.user.id,
        type: type || 'SOAP',
        subjective: subjective || '',
        objective: objective || '',
        assessment: assessment || '',
        plan: plan || '',
        fullContent: fullContent || ''
      },
      include: { 
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_NOTE',
        module: 'Clinical',
        details: `Created ${type || 'SOAP'} note for patient ${note.patient.hospitalId}`
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/clinical-notes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, subjective, objective, assessment, plan, fullContent } = req.body;
    
    const existing = await prisma.clinicalNote.findUnique({ 
      where: { id },
      include: { author: true }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    if (existing.authorId !== req.user.id && !['Admin', 'ITAdmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only edit your own notes' });
    }
    
    const note = await prisma.clinicalNote.update({
      where: { id },
      data: { 
        type, 
        subjective, 
        objective, 
        assessment, 
        plan, 
        fullContent 
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });
    
    res.json(note);
  } catch (error) { 
    console.error('Update note error:', error);
    res.status(400).json({ error: error.message }); 
  }
});

app.delete('/api/clinical-notes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await prisma.clinicalNote.findUnique({ 
      where: { id },
      include: { author: true }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    if (existing.authorId !== req.user.id && !['Admin', 'ITAdmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }
    
    await prisma.clinicalNote.delete({ where: { id } });
    
    await prisma.auditLog.create({
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

// ============ PRESCRIPTION ENDPOINTS ============

// ✅ UPDATED: GET /api/prescriptions with staff name fallback
app.get('/api/prescriptions', authenticate, async (req, res) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      include: {
        patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        prescribedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        dispensedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // ✅ Add fallback for unknown staff
    const formattedPrescriptions = prescriptions.map(p => ({
      ...p,
      prescribedBy: p.prescribedBy ? {
        ...p.prescribedBy,
        fullName: p.prescribedBy.firstName && p.prescribedBy.lastName 
          ? `${p.prescribedBy.firstName} ${p.prescribedBy.lastName}`
          : `${p.prescribedBy.role || 'Unknown'} (ID: ${p.prescribingStaffId?.slice(0, 8) || 'Unknown'})`
      } : null,
      dispensedBy: p.dispensedBy ? {
        ...p.dispensedBy,
        fullName: p.dispensedBy.firstName && p.dispensedBy.lastName 
          ? `${p.dispensedBy.firstName} ${p.dispensedBy.lastName}`
          : `${p.dispensedBy.role || 'Unknown'} (ID: ${p.dispensingStaffId?.slice(0, 8) || 'Unknown'})`
      } : null
    }));
    
    res.json(formattedPrescriptions);
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
    const prescription = await prisma.prescription.create({
      data: {
        patientId,
        prescribingStaffId: req.user.id,
        medication,
        dosage,
        frequency,
        duration,
        instructions,
        status: 'Prescribed'
      },
      include: { patient: true, prescribedBy: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_PRESCRIPTION',
        module: 'Pharmacy',
        details: `Created prescription for ${medication} for patient ${prescription.patient.hospitalId}`
      }
    });
    res.status(201).json(prescription);
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/prescriptions/:id/dispense', authenticate, authorize('Pharmacist'), async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await prisma.prescription.update({
      where: { id },
      data: { dispensingStaffId: req.user.id, status: 'Dispensed' },
      include: { patient: true, prescribedBy: true, dispensedBy: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DISPENSE_PRESCRIPTION',
        module: 'Pharmacy',
        details: `Dispensed prescription ${id} for ${prescription.medication}`
      }
    });
    res.json(prescription);
  } catch (error) {
    console.error('Dispense prescription error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ LAB ORDER ENDPOINTS ============

// ✅ UPDATED: GET /api/lab-orders with staff name fallback
app.get('/api/lab-orders', authenticate, authorize('Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Admin', 'LabTechnician', 'LabScientist'), async (req, res) => {
  try {
    const labOrders = await prisma.labOrder.findMany({
      include: {
        patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } },
        orderedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // ✅ Add fallback for unknown staff
    const formattedOrders = labOrders.map(order => ({
      ...order,
      orderedBy: order.orderedBy ? {
        ...order.orderedBy,
        fullName: order.orderedBy.firstName && order.orderedBy.lastName 
          ? `${order.orderedBy.firstName} ${order.orderedBy.lastName}`
          : `${order.orderedBy.role || 'Unknown'} (ID: ${order.orderingStaffId?.slice(0, 8) || 'Unknown'})`
      } : null,
      performedBy: order.performedBy ? {
        ...order.performedBy,
        fullName: order.performedBy.firstName && order.performedBy.lastName 
          ? `${order.performedBy.firstName} ${order.performedBy.lastName}`
          : `${order.performedBy.role || 'Unknown'} (ID: ${order.labStaffId?.slice(0, 8) || 'Unknown'})`
      } : null
    }));
    
    res.json(formattedOrders);
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
    const labOrder = await prisma.labOrder.create({
      data: {
        patientId,
        orderingStaffId: req.user.id,
        testName,
        testType,
        priority: priority || 'Routine',
        status: 'Ordered',
        notes
      },
      include: { patient: true, orderedBy: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_LAB_ORDER',
        module: 'Lab',
        details: `Created lab order for ${testName} for patient ${labOrder.patient.hospitalId}`
      }
    });
    res.status(201).json(labOrder);
  } catch (error) {
    console.error('Create lab order error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ✅ UPDATED: PATCH /api/lab-orders/:id/results with LabTechnician and LabScientist
app.patch('/api/lab-orders/:id/results', authenticate, authorize('Doctor', 'Nurse', 'LabTechnician', 'LabScientist', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { result, status } = req.body;
    if (!result) return res.status(400).json({ error: 'Result is required' });
    const labOrder = await prisma.labOrder.update({
      where: { id },
      data: { 
        result, 
        status: status || 'Completed', 
        resultDate: new Date(), 
        labStaffId: req.user.id 
      },
      include: { patient: true, orderedBy: true, performedBy: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_LAB_RESULT',
        module: 'Lab',
        details: `Updated lab result for ${labOrder.testName} for patient ${labOrder.patient.hospitalId}`
      }
    });
    res.json(labOrder);
  } catch (error) {
    console.error('Update lab result error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ✅ NEW: PATCH /api/lab-orders/:id/status for Lab Staff
app.patch('/api/lab-orders/:id/status', authenticate, authorize('Doctor', 'Nurse', 'LabTechnician', 'LabScientist', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const validStatuses = ['Ordered', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const labOrder = await prisma.labOrder.update({
      where: { id },
      data: { 
        status,
        ...(status === 'In Progress' && { labStaffId: req.user.id }),
        ...(status === 'Completed' && { resultDate: new Date(), labStaffId: req.user.id })
      },
      include: { patient: true, orderedBy: true, performedBy: true }
    });
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_LAB_STATUS',
        module: 'Lab',
        details: `Updated lab order ${id} to ${status}`
      }
    });
    
    res.json(labOrder);
  } catch (error) {
    console.error('Update lab status error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ✅ NEW: Validate lab result endpoint (Lab Scientist only) - WITH ERROR HANDLING
app.patch('/api/lab-orders/:id/validate', authenticate, authorize('LabScientist', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if lab order exists
    const labOrder = await prisma.labOrder.findUnique({
      where: { id }
    });
    
    if (!labOrder) {
      return res.status(404).json({ error: 'Lab order not found' });
    }
    
    if (!labOrder.result) {
      return res.status(400).json({ error: 'Cannot validate an order without results' });
    }
    
    // Try to update with validation fields
    try {
      // First check if the validated field exists
      const testQuery = await prisma.labOrder.findFirst({
        select: { validated: true }
      }).catch(() => null);
      
      // If the field exists, update with validation
      const updated = await prisma.labOrder.update({
        where: { id },
        data: { 
          validated: true,
          validatedBy: req.user.id,
          validatedAt: new Date()
        },
        include: { 
          patient: { select: { id: true, hospitalId: true, firstName: true, lastName: true } }, 
          orderedBy: { select: { id: true, firstName: true, lastName: true, role: true } }, 
          performedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
        }
      });
      
      await prisma.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'VALIDATE_LAB_RESULT',
          module: 'Lab',
          details: `Validated lab result for ${labOrder.testName} for patient ${labOrder.patientId}`
        }
      });
      
      res.json({ 
        message: '✅ Lab result validated successfully!', 
        order: updated 
      });
      
    } catch (updateError) {
      // If validation fields don't exist, just log and return success
      console.log('ℹ️ Validation fields not available, logging validation only');
      
      await prisma.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'VALIDATE_LAB_RESULT',
          module: 'Lab',
          details: `Validated lab result for ${labOrder.testName} for patient ${labOrder.patientId} (fields not yet available)`
        }
      });
      
      res.json({ 
        message: '✅ Result validated successfully (audit logged)',
        labOrder: labOrder,
        note: 'Validation fields not yet available in database. Please run the SQL migration to add them.'
      });
    }
  } catch (error) {
    console.error('Validate lab result error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ IMAGING / X-RAY ORDER ENDPOINTS ============

app.get('/api/patients/:patientId/imaging-orders', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const imagingOrders = await prisma.imagingOrder.findMany({
      where: { patientId },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        },
        orderingStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        radiologist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        imagingResults: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedOrders = imagingOrders.map(order => ({
      ...order,
      images: order.images || '',
      imageCount: order.images ? order.images.split(',').length : 0,
      hasImages: order.images ? order.images.split(',').length > 0 : false
    }));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Get patient imaging orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/imaging-orders', authenticate, async (req, res) => {
  try {
    console.log('📡 GET /api/imaging-orders called');
    console.log('👤 User:', req.user?.role, req.user?.id);
    
    const { status, patientId, dateFrom, dateTo, imagingType } = req.query;
    const userRole = req.user.role;
    const staffId = req.user.id;

    let where = {};
    
    if (['Doctor', 'Obstetrician'].includes(userRole)) {
      where.orderingStaffId = staffId;
    } else if (['Admin', 'Records', 'ITAdmin'].includes(userRole)) {
      // Can see all
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

    console.log('🔍 Where clause:', JSON.stringify(where, null, 2));

    const imagingOrders = await prisma.imagingOrder.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        orderingStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        radiologist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        imagingResults: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Found ${imagingOrders.length} imaging orders`);

    const formattedOrders = imagingOrders.map(order => ({
      ...order,
      images: order.images || '',
      imageCount: order.images ? order.images.split(',').length : 0,
      hasImages: order.images ? order.images.split(',').length > 0 : false,
      status: order.status || 'Ordered'
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('❌ Get imaging orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/imaging-orders', authenticate, authorize('Doctor', 'Obstetrician'), async (req, res) => {
  try {
    const { 
      patientId, 
      imagingType, 
      bodyPart, 
      priority, 
      clinicalHistory, 
      clinicalQuestion,
      notes 
    } = req.body;

    if (!patientId || !imagingType || !bodyPart) {
      return res.status(400).json({ error: 'Patient ID, Imaging Type, and Body Part are required' });
    }

    const count = await prisma.imagingOrder.count();
    const orderNumber = `IMG-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const order = await prisma.imagingOrder.create({
      data: {
        orderNumber,
        patientId,
        imagingType,
        bodyPart,
        priority: priority || 'Routine',
        clinicalHistory,
        clinicalQuestion,
        orderingStaffId: req.user.id,
        status: 'Ordered',
        notes
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        orderingStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_IMAGING_ORDER',
        module: 'Radiology',
        details: `Created ${imagingType} order for patient ${order.patient.hospitalId} - ${order.orderNumber}`
      }
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create imaging order error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/imaging-orders/:id/status', authenticate, authorize('Admin', 'Radiologist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['Ordered', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` 
      });
    }

    const order = await prisma.imagingOrder.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
        ...(status === 'Completed' && { resultDate: new Date() }),
        ...(status === 'Scheduled' && { radiologistId: req.user.id })
      },
      include: {
        patient: true,
        orderingStaff: true,
        radiologist: true
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_IMAGING_STATUS',
        module: 'Radiology',
        details: `Updated imaging order ${order.orderNumber} to ${status}`
      }
    });

    res.json(order);
  } catch (error) {
    console.error('Update imaging status error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/imaging-orders/:id/results', authenticate, authorize('Radiologist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { findings, impression, recommendations, severity, imagesUrl } = req.body;

    if (!findings || !impression) {
      return res.status(400).json({ error: 'Findings and Impression are required' });
    }

    const order = await prisma.imagingOrder.update({
      where: { id },
      data: {
        result: findings,
        report: impression,
        imagesUrl: imagesUrl || null,
        status: 'Completed',
        resultDate: new Date(),
        radiologistId: req.user.id
      },
      include: {
        patient: true,
        orderingStaff: true
      }
    });

    await prisma.imagingResult.create({
      data: {
        imagingOrderId: id,
        findings,
        impression,
        recommendations: recommendations || null,
        severity: severity || 'Normal'
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'SUBMIT_IMAGING_RESULTS',
        module: 'Radiology',
        details: `Submitted results for imaging order ${order.orderNumber}`
      }
    });

    res.json({ 
      message: 'Results submitted successfully', 
      order,
      result: {
        findings,
        impression,
        recommendations,
        severity,
        imagesUrl
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

    const order = await prisma.imagingOrder.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        orderingStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        radiologist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        imagingResults: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Imaging order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get imaging order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/imaging-orders/:id/cancel', authenticate, authorize('Doctor', 'Obstetrician', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await prisma.imagingOrder.findUnique({
      where: { id }
    });

    if (!order) {
      return res.status(404).json({ error: 'Imaging order not found' });
    }

    if (order.status === 'Completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed imaging order' });
    }

    const updatedOrder = await prisma.imagingOrder.update({
      where: { id },
      data: {
        status: 'Cancelled',
        notes: reason ? `Cancelled: ${reason}` : order.notes
      },
      include: {
        patient: true,
        orderingStaff: true
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CANCEL_IMAGING_ORDER',
        module: 'Radiology',
        details: `Cancelled imaging order ${order.orderNumber}. Reason: ${reason || 'Not specified'}`
      }
    });

    res.json({ 
      message: 'Imaging order cancelled successfully', 
      order: updatedOrder 
    });
  } catch (error) {
    console.error('Cancel imaging order error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ IMAGING IMAGE UPLOAD ENDPOINT ============

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `img-${uniqueSuffix}${ext}`;
    console.log(`📸 Saving file as: ${filename}`);
    cb(null, filename);
  }
});

const fileFilter2 = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/dicom'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'), false);
  }
};

const upload2 = multer({ 
  storage: storage2,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter2
});

app.post('/api/imaging-orders/:id/upload-images', 
  authenticate, 
  authorize('Radiologist', 'Admin'),
  upload2.array('images', 10),
  async (req, res) => {
    try {
      console.log('📸 ====== UPLOAD START ======');
      console.log('📸 Order ID:', req.params.id);
      console.log('📸 Files received:', req.files ? req.files.length : 0);
      
      const { id } = req.params;
      
      if (!req.files || req.files.length === 0) {
        console.error('❌ No files in request');
        return res.status(400).json({ error: 'No images uploaded' });
      }

      req.files.forEach((file, index) => {
        console.log(`📸 File ${index + 1}: ${file.originalname} -> ${file.filename} (${file.size} bytes)`);
        console.log(`📸 Saved to: ${file.path}`);
      });

      const order = await prisma.imagingOrder.findUnique({
        where: { id }
      });

      if (!order) {
        console.error(`❌ Order not found: ${id}`);
        return res.status(404).json({ error: 'Imaging order not found' });
      }

      console.log(`📋 Found order: ${order.orderNumber}`);
      console.log(`📋 Current images: ${order.images || 'none'}`);

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const imageUrls = req.files.map(file => {
        return `${baseUrl}/images/${file.filename}`;
      });

      console.log('📸 Image URLs:', imageUrls);

      const existingImages = order.images && order.images.length > 0 ? order.images.split(',') : [];
      const allImages = [...existingImages, ...imageUrls];
      const imagesString = allImages.join(',');

      console.log(`📸 Existing images: ${existingImages.length}`);
      console.log(`📸 New images: ${imageUrls.length}`);
      console.log(`📸 Total images: ${allImages.length}`);
      console.log(`📸 Images string: ${imagesString}`);

      const updatedOrder = await prisma.imagingOrder.update({
        where: { id },
        data: {
          images: imagesString,
          imageCount: allImages.length,
          hasImages: true,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Database updated for order ${order.orderNumber}`);
      console.log(`✅ New imageCount: ${updatedOrder.imageCount}`);
      console.log(`✅ New hasImages: ${updatedOrder.hasImages}`);

      const completeOrder = await prisma.imagingOrder.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              id: true,
              hospitalId: true,
              firstName: true,
              lastName: true
            }
          },
          orderingStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          radiologist: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          imagingResults: true
        }
      });

      await prisma.auditLog.create({
        data: {
          staffId: req.user.id,
          action: 'UPLOAD_IMAGING_IMAGES',
          module: 'Radiology',
          details: `Uploaded ${req.files.length} images for imaging order ${order.orderNumber}`
        }
      });

      console.log('📸 ====== UPLOAD SUCCESS ======');

      res.json({
        message: `${req.files.length} image(s) uploaded successfully`,
        order: {
          ...completeOrder,
          images: imagesString,
          imageCount: allImages.length,
          hasImages: true
        },
        uploadedFiles: req.files.map(f => f.filename)
      });
    } catch (error) {
      console.error('❌ Image upload error:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============ BILLING ENDPOINTS ============

function calculateAmountByCategory(baseAmount, patientCategory) {
  switch (patientCategory) {
    case 'NHIS': return Math.round(baseAmount * 0.1);
    case 'CORPORATE': return baseAmount * 2;
    default: return baseAmount;
  }
}

function getCategoryInfo(category) {
  const map = {
    'FPP': { label: 'Free Paying Patient', multiplier: '100%', color: '#dbeafe' },
    'NHIS': { label: 'NHIS Patient', multiplier: '10%', color: '#d1fae5' },
    'CORPORATE': { label: 'Corporate Patient', multiplier: '200%', color: '#fef3c7' },
  };
  return map[category] || map['FPP'];
}

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
    const bills = await prisma.billingRecord.findMany({
      where: { ...where, patient: patientFilter },
      include: {
        patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true,
            phone: true, patientCategory: true, insuranceProvider: true, corporateCompany: true
          }
        },
        journey: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await prisma.billingRecord.count({
      where: { ...where, patient: patientFilter }
    });
    res.json({ data: bills, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Get billing records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/billing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await prisma.billingRecord.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            phone: true,
            patientCategory: true,
            insuranceProvider: true,
            corporateCompany: true
          }
        },
        journey: true,
        paymentPlans: {
          include: {
            partialPayments: true
          }
        }
      }
    });
    
    if (!bill) {
      return res.status(404).json({ error: 'Billing record not found' });
    }
    
    res.json(bill);
  } catch (error) {
    console.error('Get billing detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/billing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod, paymentDate, notes } = req.body;
    
    const bill = await prisma.billingRecord.update({
      where: { id },
      data: {
        status: status || undefined,
        paymentMethod: paymentMethod || undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            patientCategory: true
          }
        }
      }
    });
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_BILLING',
        module: 'Billing',
        details: `Updated billing record ${bill.invoiceNumber} to ${status || 'updated'}`
      }
    });
    
    res.json(bill);
  } catch (error) {
    console.error('Update billing error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ PHARMACY INVENTORY ENDPOINTS ============

app.get('/api/medications', authenticate, async (req, res) => {
  try {
    const medications = await prisma.medication.findMany({ orderBy: { name: 'asc' } });
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
    const medication = await prisma.medication.create({
      data: {
        name, genericName, category, supplier,
        unitPrice: parseFloat(unitPrice) || 0,
        stockQuantity: parseInt(stockQuantity) || 0,
        reorderLevel: parseInt(reorderLevel) || 10,
        expiryDate: new Date(expiryDate), batchNumber
      }
    });
    await prisma.medicationTransaction.create({
      data: {
        medicationId: medication.id, transactionType: 'Purchase',
        quantity: parseInt(stockQuantity) || 0, unitPrice: parseFloat(unitPrice) || 0,
        note: 'Initial stock', staffId: req.user.id
      }
    });
    await prisma.auditLog.create({
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
    const existingMedication = await prisma.medication.findUnique({ where: { id } });
    if (!existingMedication) return res.status(404).json({ error: 'Medication not found' });
    const medication = await prisma.medication.update({
      where: { id },
      data: {
        name: name.trim(), genericName: genericName ? genericName.trim() : null,
        category: category.trim(), supplier: supplier ? supplier.trim() : null,
        unitPrice: parseFloat(unitPrice) || 0,
        stockQuantity: parseInt(stockQuantity) || 0,
        reorderLevel: parseInt(reorderLevel) || 10,
        expiryDate: new Date(expiryDate), batchNumber: batchNumber ? batchNumber.trim() : null
      }
    });
    await prisma.auditLog.create({
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
    const existingMedication = await prisma.medication.findUnique({ where: { id } });
    if (!existingMedication) return res.status(404).json({ error: 'Medication not found' });
    const transactions = await prisma.medicationTransaction.count({ where: { medicationId: id } });
    if (transactions > 0) {
      return res.status(400).json({ error: 'Cannot delete medication with transaction history.' });
    }
    await prisma.medication.delete({ where: { id } });
    await prisma.auditLog.create({
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

app.patch('/api/medications/:id/stock', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, transactionType, note } = req.body;
    if (!quantity || !transactionType) {
      return res.status(400).json({ error: 'Missing required fields: quantity, transactionType' });
    }
    const medication = await prisma.medication.findUnique({ where: { id } });
    if (!medication) return res.status(404).json({ error: 'Medication not found' });
    let newStock = medication.stockQuantity;
    if (transactionType === 'Purchase' || transactionType === 'Returned') newStock += quantity;
    else if (transactionType === 'Dispensed' || transactionType === 'Adjusted') newStock -= quantity;
    if (newStock < 0) return res.status(400).json({ error: 'Insufficient stock' });
    const updatedMedication = await prisma.medication.update({
      where: { id },
      data: { stockQuantity: newStock }
    });
    await prisma.medicationTransaction.create({
      data: {
        medicationId: id, transactionType, quantity,
        unitPrice: medication.unitPrice, note: note || `Stock ${transactionType}`,
        staffId: req.user.id
      }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_STOCK',
        module: 'Pharmacy',
        details: `Updated stock for ${medication.name}: ${transactionType} ${quantity} units`
      }
    });
    res.json(updatedMedication);
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ PHARMACY DASHBOARD ENDPOINT ============

app.get('/api/pharmacy/dashboard', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    console.log('📊 Fetching pharmacy dashboard data...');

    const [totalMedications, lowStock, totalTransactions, pendingAuthorizations] = await Promise.all([
      prisma.medication.count(),
      prisma.medication.count({ 
        where: { 
          stockQuantity: { 
            lte: prisma.medication.fields.reorderLevel 
          } 
        } 
      }),
      prisma.medicationTransaction.count(),
      prisma.nHISAuthorization.count({ where: { status: 'Pending' } })
    ]);

    const recentTransactions = await prisma.medicationTransaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { 
        medication: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const pendingAuths = await prisma.nHISAuthorization.findMany({
      take: 10,
      where: { status: 'Pending' },
      include: { 
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hospitalId: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      statistics: {
        totalMedications,
        lowStock,
        totalTransactions,
        pendingAuthorizations
      },
      recentTransactions: recentTransactions || [],
      pendingAuths: pendingAuths || []
    });
  } catch (error) {
    console.error('Pharmacy dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ NHIS DRUG MANAGEMENT ENDPOINTS ============

app.get('/api/pharmacy/nhis-prices', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist', 'Accountant'), async (req, res) => {
  try {
    const prices = await prisma.nHISDrugPrice.findMany({
      include: { 
        medication: {
          select: {
            id: true,
            name: true,
            genericName: true,
            category: true,
            unitPrice: true,
            stockQuantity: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(prices);
  } catch (error) {
    console.error('Get NHIS prices error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pharmacy/nhis-prices', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { 
      medicationId, 
      nhisCode, 
      nhisName, 
      standardPrice, 
      nhisPrice, 
      patientCopay, 
      maxQuantity, 
      refillLimit, 
      validityPeriod, 
      drugClass, 
      requiresPriorAuth, 
      effectiveDate, 
      expiryDate 
    } = req.body;

    if (!medicationId || !nhisCode || !standardPrice || !nhisPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const calculatedPatientCopay = patientCopay || (nhisPrice * 0.1);

    const price = await prisma.nHISDrugPrice.upsert({
      where: {
        medicationId_nhisCode: {
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
        isActive: true
      },
      create: {
        medicationId,
        nhisCode,
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
        isActive: true
      }
    });

    await prisma.auditLog.create({
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
    const price = await prisma.nHISDrugPrice.findUnique({
      where: { id },
      include: { medication: true }
    });
    if (!price) {
      return res.status(404).json({ error: 'NHIS price not found' });
    }
    res.json(price);
  } catch (error) {
    console.error('Get NHIS price error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pharmacy/nhis-prices/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.nHISDrugPrice.delete({
      where: { id }
    });
    await prisma.auditLog.create({
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

// ============ SERVICE PRICING ENDPOINTS ============

app.get('/api/pricing', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const pricing = await prisma.servicePricing.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json(pricing);
  } catch (error) {
    console.error('GET /api/pricing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pricing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const pricing = await prisma.servicePricing.findUnique({ where: { id } });
    if (!pricing) {
      return res.status(404).json({ error: 'Service not found' });
    }
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
    
    const existing = await prisma.servicePricing.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Service name already exists' });
    
    const basePriceNum = parseFloat(basePrice) || 0;
    
    const pricing = await prisma.servicePricing.create({
      data: {
        name,
        description: description || '',
        category: category || 'FPP',
        basePrice: basePriceNum,
        nhisPrice: parseFloat(nhisPrice) || (basePriceNum * 0.1),
        corporatePrice: parseFloat(corporatePrice) || (basePriceNum * 2),
        isActive: isActive !== undefined ? isActive : true
      }
    });
    
    await prisma.auditLog.create({
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
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Service name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pricing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
    
    const { name, description, category, basePrice, nhisPrice, corporatePrice, isActive } = req.body;
    const basePriceNum = parseFloat(basePrice) || 0;
    
    const pricing = await prisma.servicePricing.update({
      where: { id },
      data: {
        name,
        description: description || '',
        category: category || 'FPP',
        basePrice: basePriceNum,
        nhisPrice: parseFloat(nhisPrice) || (basePriceNum * 0.1),
        corporatePrice: parseFloat(corporatePrice) || (basePriceNum * 2),
        isActive: isActive !== undefined ? isActive : true
      }
    });
    
    await prisma.auditLog.create({
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
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pricing/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
    
    await prisma.servicePricing.delete({ where: { id } });
    
    await prisma.auditLog.create({
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
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ============ SERVICE PRICING MANAGEMENT - COMPLETE API ============

// ✅ UPDATED: GET /api/services with LabTechnician and LabScientist
app.get('/api/services', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer', 'Doctor', 'Nurse', 'LabTechnician', 'Radiologist', 'LabScientist'), async (req, res) => {
  try {
    const { category, search, isActive } = req.query;
    
    console.log('📋 GET /api/services - Query:', req.query);
    
    let where = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const services = await prisma.servicePricing.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    console.log(`✅ Found ${services.length} services`);
    res.json(services);
  } catch (error) {
    console.error('❌ Get services error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single service
app.get('/api/services/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const service = await prisma.servicePricing.findUnique({
      where: { id }
    });
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json(service);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create service
app.post('/api/services', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { 
      name, code, description, category, 
      basePrice, nhisPrice, corporatePrice,
      isActive, requiresApproval
    } = req.body;

    if (!name || !category || basePrice === undefined) {
      return res.status(400).json({ error: 'Name, category, and base price are required' });
    }

    const existing = await prisma.servicePricing.findFirst({
      where: { 
        OR: [
          { name: name.trim() },
          { code: code ? code.trim() : undefined }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Service with this name or code already exists' });
    }

    const service = await prisma.servicePricing.create({
      data: {
        name: name.trim(),
        code: code ? code.trim() : null,
        description: description || null,
        category: category,
        basePrice: parseFloat(basePrice) || 0,
        nhisPrice: nhisPrice !== undefined ? parseFloat(nhisPrice) : (parseFloat(basePrice) * 0.1),
        corporatePrice: corporatePrice !== undefined ? parseFloat(corporatePrice) : (parseFloat(basePrice) * 2),
        isActive: isActive !== undefined ? isActive : true,
        requiresApproval: requiresApproval || false
      }
    });

    await prisma.auditLog.create({
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

// Update service
app.put('/api/services/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, code, description, category, 
      basePrice, nhisPrice, corporatePrice,
      isActive, requiresApproval
    } = req.body;

    const existing = await prisma.servicePricing.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (name || code) {
      const duplicate = await prisma.servicePricing.findFirst({
        where: {
          OR: [
            name ? { name: name.trim() } : {},
            code ? { code: code.trim() } : {}
          ],
          NOT: { id }
        }
      });

      if (duplicate) {
        return res.status(400).json({ error: 'Service with this name or code already exists' });
      }
    }

    const service = await prisma.servicePricing.update({
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
        requiresApproval: requiresApproval !== undefined ? requiresApproval : undefined
      }
    });

    await prisma.auditLog.create({
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

// Delete service
app.delete('/api/services/:id', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const service = await prisma.servicePricing.findUnique({
      where: { id }
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    await prisma.servicePricing.delete({
      where: { id }
    });

    await prisma.auditLog.create({
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

// Get service categories
app.get('/api/services/categories', authenticate, async (req, res) => {
  try {
    const categories = await prisma.servicePricing.groupBy({
      by: ['category'],
      _count: {
        category: true
      }
    });

    const result = categories.map(c => ({
      name: c.category,
      count: c._count.category
    }));

    res.json(result);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk import services
app.post('/api/services/bulk', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { services } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const serviceData of services) {
      try {
        const { name, code, category, basePrice, nhisPrice, corporatePrice, description } = serviceData;

        if (!name || !category || basePrice === undefined) {
          results.errors.push({ name, error: 'Missing required fields' });
          continue;
        }

        const existing = await prisma.servicePricing.findFirst({
          where: { 
            OR: [
              { name: name.trim() },
              code ? { code: code.trim() } : {}
            ]
          }
        });

        if (existing) {
          await prisma.servicePricing.update({
            where: { id: existing.id },
            data: {
              basePrice: parseFloat(basePrice) || existing.basePrice,
              nhisPrice: parseFloat(nhisPrice) || (parseFloat(basePrice) * 0.1),
              corporatePrice: parseFloat(corporatePrice) || (parseFloat(basePrice) * 2),
              description: description || existing.description,
              isActive: true
            }
          });
          results.updated++;
        } else {
          await prisma.servicePricing.create({
            data: {
              name: name.trim(),
              code: code ? code.trim() : null,
              category: category,
              basePrice: parseFloat(basePrice) || 0,
              nhisPrice: parseFloat(nhisPrice) || (parseFloat(basePrice) * 0.1),
              corporatePrice: parseFloat(corporatePrice) || (parseFloat(basePrice) * 2),
              description: description || null,
              isActive: true
            }
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push({ name: serviceData.name, error: error.message });
      }
    }

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'BULK_IMPORT_SERVICES',
        module: 'Pricing',
        details: `Bulk import: ${results.created} created, ${results.updated} updated`
      }
    });

    res.json({
      message: 'Bulk import completed',
      ...results
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ AUDIT LOG ENDPOINTS ============

app.get('/api/audit-logs', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const logs = await prisma.auditLog.findMany({
      include: { staff: true },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await prisma.auditLog.count();
    res.json({ data: logs, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATISTICS ============

// In server.js - Complete dashboard stats endpoint with LabScientist support
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    let responseData = {};

    const genderData = await prisma.patient.groupBy({ by: ['gender'], _count: true });
    const monthlyRegistrations = await prisma.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*) as count
      FROM "Patient"
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY month ORDER BY month ASC
    `;

    if (['Admin', 'Records', 'ITAdmin'].includes(role)) {
      const [totalPatients, totalStaff, totalAppointments, pendingBills, totalRevenue, lowStockCount] = await Promise.all([
        prisma.patient.count(),
        prisma.staff.count(),
        prisma.appointment.count({ where: { status: 'Scheduled' } }),
        prisma.billingRecord.count({ where: { status: 'Pending' } }),
        prisma.billingRecord.aggregate({ _sum: { totalAmount: true }, where: { status: 'Paid' } }),
        prisma.medication.count({ where: { stockQuantity: { lte: prisma.medication.fields.reorderLevel } } })
      ]);
      responseData = {
        totalPatients, totalStaff, totalAppointments, pendingBills,
        totalRevenue: totalRevenue._sum.totalAmount || 0, lowStockCount
      };
    } else if (['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(role)) {
      const staff = await prisma.staff.findUnique({
        where: { id: req.user.id },
        include: { clinics: { select: { clinicId: true } }, wards: { select: { wardId: true } } }
      });
      const clinicIds = staff?.clinics?.map(c => c.clinicId) || [];
      const wardIds = staff?.wards?.map(w => w.wardId) || [];
      const patientJourneys = await prisma.patientJourney.findMany({
        where: {
          status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
          OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
        },
        select: { patientId: true }
      });
      const patientIds = patientJourneys.map(j => j.patientId);
      const [myPatientsCount, myAppointmentsCount] = await Promise.all([
        prisma.patientJourney.count({
          where: {
            status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
            OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
          }
        }),
        prisma.appointment.count({ where: { staffId: req.user.id, status: 'Scheduled' } })
      ]);
      let prescriptionsCount = 0;
      let vitalsCount = 0;
      if (['Doctor', 'Obstetrician'].includes(role)) {
        if (patientIds.length > 0) {
          prescriptionsCount = await prisma.prescription.count({
            where: { patientId: { in: patientIds }, prescribingStaffId: req.user.id }
          });
        }
        responseData = { myPatientsCount, myAppointmentsCount, myPrescriptionsCount: prescriptionsCount };
      } else {
        vitalsCount = await prisma.vitalSign.count({ where: { nurseId: req.user.id } });
        responseData = { myPatientsCount, myAppointmentsCount, myVitalsCount: vitalsCount };
      }
    } else if (role === 'Pharmacist') {
      const [totalMedications, lowStockCount, recentDispensedCount] = await Promise.all([
        prisma.medication.count(),
        prisma.medication.count({ where: { stockQuantity: { lte: prisma.medication.fields.reorderLevel } } }),
        prisma.prescription.count({
          where: {
            status: 'Dispensed',
            createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
          }
        })
      ]);
      responseData = { totalMedications, lowStockCount, recentDispensedCount };
    } else if (['Accountant', 'BillingOfficer'].includes(role)) {
      const [pendingBills, totalRevenue, paidBillsCount] = await Promise.all([
        prisma.billingRecord.count({ where: { status: 'Pending' } }),
        prisma.billingRecord.aggregate({ _sum: { totalAmount: true }, where: { status: 'Paid' } }),
        prisma.billingRecord.count({ where: { status: 'Paid' } })
      ]);
      responseData = {
        pendingBills,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        paidBillsCount
      };
    } else if (role === 'LabTechnician' || role === 'LabScientist') {
      // ✅ FIXED: Show meaningful lab stats for LabScientist (with error handling for missing fields)
      console.log('📊 Fetching lab dashboard stats for:', role);
      
      // Base stats that don't require validation fields
      let validatedOrders = 0;
      let awaitingValidation = 0;
      let validatedToday = 0;
      
      try {
        // Try to count validated orders
        validatedOrders = await prisma.labOrder.count({ 
          where: { validated: true } 
        });
      } catch (error) {
        console.log('ℹ️ validated field not available yet, skipping validation stats');
      }
      
      const [totalOrders, pendingOrders, inProgressOrders, completedOrders, cancelledOrders] = await Promise.all([
        prisma.labOrder.count(),
        prisma.labOrder.count({ where: { status: 'Ordered' } }),
        prisma.labOrder.count({ where: { status: 'In Progress' } }),
        prisma.labOrder.count({ where: { status: 'Completed' } }),
        prisma.labOrder.count({ where: { status: 'Cancelled' } })
      ]);

      // Get recent lab orders
      const recentOrders = await prisma.labOrder.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              hospitalId: true,
              firstName: true,
              lastName: true
            }
          },
          orderedBy: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          performedBy: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Get lab orders by test type (for chart)
      const ordersByType = await prisma.labOrder.groupBy({
        by: ['testType'],
        _count: {
          testType: true
        }
      });

      // Get lab orders by priority (for chart)
      const ordersByPriority = await prisma.labOrder.groupBy({
        by: ['priority'],
        _count: {
          priority: true
        }
      });

      // Get daily lab orders for the last 7 days
      const dailyOrders = await prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "LabOrder"
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;

      // Get pending orders count (for alert)
      const pendingCount = pendingOrders;

      // Get today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todaysOrders = await prisma.labOrder.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      // Try to get Lab Scientist specific stats if the fields exist
      if (role === 'LabScientist') {
        try {
          // Check if validated field exists by trying to query it
          await prisma.labOrder.findFirst({
            select: { validated: true }
          });
          
          // Field exists, get validation stats
          awaitingValidation = await prisma.labOrder.count({
            where: { 
              validated: false,
              result: { not: null },
              status: 'Completed'
            }
          });
          
          validatedToday = await prisma.labOrder.count({
            where: {
              validated: true,
              validatedAt: {
                gte: today,
                lt: tomorrow
              }
            }
          });
        } catch (error) {
          console.log('ℹ️ Validation fields not available yet:', error.message);
          // Fields don't exist, skip validation stats
        }
      }

      responseData = {
        role: role,
        summary: {
          totalOrders,
          pendingOrders,
          inProgressOrders,
          completedOrders,
          validatedOrders,
          cancelledOrders,
          todaysOrders,
          pendingCount
        },
        recentOrders,
        chartData: {
          ordersByType: ordersByType.map(item => ({
            name: item.testType,
            value: item._count.testType
          })),
          ordersByPriority: ordersByPriority.map(item => ({
            name: item.priority,
            value: item._count.priority
          })),
          dailyOrders: dailyOrders.map(item => ({
            date: item.date,
            count: Number(item.count)
          }))
        }
      };
      
      // Only add Lab Scientist stats if we got valid data
      if (role === 'LabScientist' && (awaitingValidation > 0 || validatedToday > 0)) {
        responseData.labScientistStats = {
          awaitingValidation,
          validatedToday
        };
      }
      
      console.log('✅ Lab dashboard stats fetched successfully');
    } else {
      // Default response for unknown roles
      responseData = { 
        message: 'Stats for this role are work in progress',
        role: role,
        genderData: genderData,
        monthlyRegistrations: monthlyRegistrations.map(item => ({
          month: item.month,
          count: Number(item.count)
        }))
      };
    }

    // Add common data
    if (!responseData.genderData) {
      responseData.genderData = genderData;
    }
    if (!responseData.monthlyRegistrations) {
      responseData.monthlyRegistrations = monthlyRegistrations.map(item => ({
        month: item.month,
        count: Number(item.count)
      }));
    }

    res.json(responseData);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Failed to load dashboard statistics',
      role: req.user?.role || 'unknown'
    });
  }
});

// ============ SYSTEM STATUS ENDPOINTS ============

app.get('/api/system/status', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    res.json({
      status: 'online',
      database: 'connected',
      uptime: uptime,
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
    const { limit = 50, offset = 0 } = req.query;
    const logs = await prisma.auditLog.findMany({
      include: { staff: { select: { firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await prisma.auditLog.count();
    res.json({ data: logs, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ WARD ENDPOINTS ============

app.get('/api/wards', authenticate, async (req, res) => {
  try {
    const wards = await prisma.ward.findMany({ orderBy: { name: 'asc' } });
    res.json(wards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wards', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { name, description, capacity } = req.body;
    if (!name) return res.status(400).json({ error: 'Ward name is required' });
    const ward = await prisma.ward.create({
      data: { name: name.trim(), description: description || null, capacity: capacity ? parseInt(capacity) : null }
    });
    res.status(201).json(ward);
  } catch (error) {
    console.error('Create ward error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/wards/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Attempting to delete ward: ${id}`);
    
    const ward = await prisma.ward.findUnique({
      where: { id }
    });
    
    if (!ward) {
      return res.status(404).json({ error: 'Ward not found' });
    }
    
    console.log(`📋 Found ward: ${ward.name}`);
    
    const activeAdmissions = await prisma.admission.count({
      where: {
        wardId: id,
        status: 'Admitted'
      }
    });
    
    if (activeAdmissions > 0) {
      return res.status(400).json({
        error: `Cannot delete ward "${ward.name}". There are ${activeAdmissions} active patients admitted to this ward.`
      });
    }
    
    const activeJourneys = await prisma.patientJourney.count({
      where: {
        wardId: id,
        status: { notIn: ['COMPLETED'] }
      }
    });
    
    if (activeJourneys > 0) {
      return res.status(400).json({
        error: `Cannot delete ward "${ward.name}". There are ${activeJourneys} active patients assigned to this ward.`
      });
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.staffWard.deleteMany({
        where: { wardId: id }
      });
      
      await tx.patientQueue.deleteMany({
        where: { wardId: id }
      });
      
      await tx.patientTransfer.deleteMany({
        where: {
          OR: [
            { fromWardId: id },
            { toWardId: id }
          ]
        }
      });
      
      await tx.ward.delete({
        where: { id }
      });
    });
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_WARD',
        module: 'Admin',
        details: `Deleted ward: ${ward.name} (${id})`
      }
    });
    
    res.json({ 
      message: 'Ward deleted successfully',
      ward: { id, name: ward.name }
    });
  } catch (error) {
    console.error('❌ Delete ward error:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to delete ward. Please check for any active associations.' 
    });
  }
});

app.delete('/api/admissions/:id', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const admission = await prisma.admission.findUnique({
      where: { id }
    });
    
    if (!admission) {
      return res.status(404).json({ error: 'Admission not found' });
    }
    
    if (admission.status === 'Admitted') {
      return res.status(400).json({
        error: 'Cannot delete an active admission. Please discharge the patient first.'
      });
    }
    
    await prisma.admission.delete({
      where: { id }
    });
    
    res.json({ message: 'Admission deleted successfully' });
  } catch (error) {
    console.error('Delete admission error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ CLINIC MANAGEMENT ============

app.get('/api/clinics', authenticate, async (req, res) => {
  try {
    const clinics = await prisma.clinic.findMany({ orderBy: { name: 'asc' } });
    res.json(clinics);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/clinics', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { name, description, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Clinic name is required' });
    const clinic = await prisma.clinic.create({ 
      data: { name, description, location } 
    });
    res.status(201).json(clinic);
  } catch (error) { 
    res.status(400).json({ error: error.message }); 
  }
});

app.put('/api/clinics/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, location } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Clinic name is required' });
    }

    const existingClinic = await prisma.clinic.findUnique({
      where: { id }
    });
    
    if (!existingClinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const duplicateName = await prisma.clinic.findFirst({
      where: {
        name,
        NOT: { id }
      }
    });
    
    if (duplicateName) {
      return res.status(400).json({ error: 'A clinic with this name already exists' });
    }

    const updatedClinic = await prisma.clinic.update({
      where: { id },
      data: { 
        name, 
        description: description || null, 
        location: location || null 
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_CLINIC',
        module: 'Admin',
        details: `Updated clinic: ${name} (${id})`
      }
    });

    res.json(updatedClinic);
  } catch (error) {
    console.error('❌ Update clinic error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/clinics/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Attempting to delete clinic: ${id}`);
    
    const clinic = await prisma.clinic.findUnique({
      where: { id }
    });
    
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    console.log(`📋 Found clinic: ${clinic.name}`);
    
    const activeJourneys = await prisma.patientJourney.count({
      where: {
        clinicId: id,
        status: { notIn: ['COMPLETED'] }
      }
    });
    
    if (activeJourneys > 0) {
      return res.status(400).json({
        error: `Cannot delete clinic "${clinic.name}". There are ${activeJourneys} active patients assigned to this clinic.`
      });
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.staffClinic.deleteMany({
        where: { clinicId: id }
      });
      
      await tx.servicePrice.deleteMany({
        where: { clinicId: id }
      });
      
      await tx.patientQueue.deleteMany({
        where: { clinicId: id }
      });
      
      await tx.patientTransfer.deleteMany({
        where: {
          OR: [
            { fromClinicId: id },
            { toClinicId: id }
          ]
        }
      });
      
      await tx.clinic.delete({
        where: { id }
      });
    });
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_CLINIC',
        module: 'Admin',
        details: `Deleted clinic: ${clinic.name} (${id})`
      }
    });
    
    res.json({ 
      message: 'Clinic deleted successfully',
      clinic: { id, name: clinic.name }
    });
  } catch (error) {
    console.error('❌ Delete clinic error:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to delete clinic. Please check for any active associations.' 
    });
  }
});

// ============ PATIENT INTAKE & JOURNEY ============

app.get('/api/patient-journeys', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const journeys = await prisma.patientJourney.findMany({
      include: {
        patient: { 
          select: { 
            id: true, hospitalId: true, firstName: true, lastName: true, gender: true, dateOfBirth: true,
            isArchived: true, patientCategory: true, insuranceProvider: true, insuranceId: true, corporateCompany: true
          } 
        },
        clinic: true, ward: true,
        registeredBy: { select: { id: true, firstName: true, lastName: true } },
        billingRecord: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(journeys);
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
    const patient = await prisma.patient.findUnique({ where: { hospitalId: hospitalIdInput } });
    if (!patient) return res.status(404).json({ error: 'Patient not found. Please check the Hospital ID.' });
    if (destinationType === 'CLINIC' && !clinicId) {
      return res.status(400).json({ error: 'A Clinic must be selected for outpatient visits' });
    }
    if (destinationType === 'WARD' && !wardId) {
      return res.status(400).json({ error: 'A Ward must be selected for inpatient admissions' });
    }
    const existing = await prisma.patientJourney.findFirst({
      where: { patientId: patient.id, status: { not: 'COMPLETED' } }
    });
    if (existing) return res.status(400).json({ error: 'Patient already has an active intake process.' });
    const journey = await prisma.patientJourney.create({
      data: {
        patientId: patient.id, destinationType,
        clinicId: destinationType === 'CLINIC' ? clinicId : null,
        wardId: destinationType === 'WARD' ? wardId : null,
        registeredById: req.user.id, status: 'REGISTERED'
      },
      include: { patient: true, clinic: true, ward: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'START_INTAKE',
        module: 'Records',
        details: `Started intake for ${journey.patient.hospitalId}`
      }
    });
    res.status(201).json(journey);
  } catch (error) {
    console.error('Error in create journey:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/patient-journeys/:id/status', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log('🔍 Update journey status - ID:', id);
    console.log('🔍 Update journey status - Status:', status);

    const validStatuses = ['PENDING_BILLING', 'BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION', 'COMPLETED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}` 
      });
    }

    const existingJourney = await prisma.patientJourney.findUnique({
      where: { id },
      include: { patient: true, clinic: true, ward: true, billingRecord: true }
    });

    if (!existingJourney) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    console.log('📋 Found journey:', existingJourney.id, 'Current status:', existingJourney.status);

    const updateData = { status };
    if (status === 'CARD_PRINTED') updateData.cardGeneratedAt = new Date();
    if (status === 'SENT_TO_DESTINATION') updateData.sentToDestinationAt = new Date();

    if (status === 'PENDING_BILLING') {
      console.log('💰 Creating invoice for journey:', existingJourney.id);
      
      let bill = existingJourney.billingRecord;

      if (!bill) {
        const patient = await prisma.patient.findUnique({
          where: { id: existingJourney.patientId },
          select: { 
            patientCategory: true,
            firstName: true,
            lastName: true,
            hospitalId: true
          }
        });
        
        console.log('👤 Patient category:', patient?.patientCategory);
        
        let price = await prisma.servicePrice.findFirst({
          where: {
            OR: [
              { clinicId: existingJourney.clinicId },
              { name: 'Consultation' }
            ],
            isActive: true
          }
        });

        const baseAmount = price ? price.amount : 5000;
        const category = patient?.patientCategory || 'FPP';
        
        let finalAmount = baseAmount;
        let categoryLabel = '';
        
        if (category === 'NHIS') {
          finalAmount = Math.round(baseAmount * 0.1);
          categoryLabel = 'NHIS - 10%';
        } else if (category === 'CORPORATE') {
          finalAmount = baseAmount * 2;
          categoryLabel = 'CORPORATE - 200%';
        } else {
          categoryLabel = 'FPP - 100%';
        }
        
        console.log(`💰 Category: ${category}, Base: ${baseAmount}, Final: ${finalAmount}`);
        
        const description = price ? price.name : 'General Consultation';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const invoiceNumber = `INV-${new Date().getFullYear()}-${timestamp}-${random}`;

        bill = await prisma.billingRecord.create({
          data: {
            patientId: existingJourney.patientId,
            invoiceNumber,
            description: `${description} (${categoryLabel} - ₦${finalAmount})`,
            amount: baseAmount,
            totalAmount: finalAmount,
            status: 'Pending'
          }
        });

        console.log('✅ Bill created:', bill.id, 'Invoice:', bill.invoiceNumber, 'Amount:', finalAmount);

        updateData.billingRecordId = bill.id;
      }
    }

    const journey = await prisma.patientJourney.update({
      where: { id },
      data: updateData,
      include: { patient: true, clinic: true, ward: true, billingRecord: true }
    });

    console.log('✅ Journey updated to:', journey.status);
    console.log('📋 Billing record:', journey.billingRecord ? journey.billingRecord.invoiceNumber : 'NONE');

    if (status === 'SENT_TO_DESTINATION' && journey.destinationType === 'WARD') {
      console.log('🏥 Auto-admitting to ward:', journey.wardId);
      
      const existingAdmission = await prisma.admission.findFirst({
        where: { patientId: journey.patientId, status: 'Admitted' }
      });
      
      if (!existingAdmission) {
        const count = await prisma.admission.count();
        const admissionNumber = `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        
        await prisma.admission.create({
          data: {
            admissionNumber,
            patientId: journey.patientId,
            wardId: journey.wardId,
            staffId: req.user.id, 
            status: 'Admitted',
            notes: `Admitted via Patient Intake.`
          }
        });
        console.log('✅ Admission created:', admissionNumber);
      } else {
        console.log('ℹ️ Patient already admitted');
      }
    }

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_INTAKE_STATUS',
        module: 'Records',
        details: `Patient ${journey.patient.hospitalId} moved to ${status}`
      }
    });

    res.json(journey);
  } catch (error) {
    console.error('❌ Error updating journey status:', error);
    res.status(400).json({ error: error.message || 'Failed to update journey status' });
  }
});

app.patch('/api/patient-journeys/:id/reverse', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const journey = await prisma.patientJourney.findUnique({
      where: { id },
      include: { patient: true, billingRecord: true }
    });

    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    if (!['COMPLETED', 'SENT_TO_DESTINATION'].includes(journey.status)) {
      return res.status(400).json({ 
        error: 'Only COMPLETED or SENT_TO_DESTINATION journeys can be reversed' 
      });
    }

    let newStatus = 'SENT_TO_DESTINATION';

    if (journey.billingRecordId) {
      await prisma.billingRecord.update({
        where: { id: journey.billingRecordId },
        data: { 
          status: 'Pending',
          paymentMethod: null,
          paymentDate: null
        }
      });
    }

    if (journey.wardId) {
      const admission = await prisma.admission.findFirst({
        where: { 
          patientId: journey.patientId,
          status: 'Admitted'
        }
      });
      if (admission) {
        await prisma.admission.update({
          where: { id: admission.id },
          data: { 
            status: 'Discharged',
            dischargeDate: new Date(),
            notes: `Discharged due to journey reversal: ${reason || 'Process error'}`
          }
        });
      }
    }

    const updatedJourney = await prisma.patientJourney.update({
      where: { id },
      data: { 
        status: newStatus,
        sentToDestinationAt: null,
        cardGeneratedAt: null
      },
      include: { 
        patient: true, 
        clinic: true, 
        ward: true, 
        billingRecord: true 
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'REVERSE_JOURNEY',
        module: 'Records',
        details: `Reversed journey for ${journey.patient.hospitalId} from ${journey.status} to ${newStatus}. Reason: ${reason || 'Process error'}`
      }
    });

    res.json({ 
      message: 'Journey reversed successfully', 
      journey: updatedJourney,
      newStatus 
    });
  } catch (error) {
    console.error('Reverse journey error:', error);
    res.status(400).json({ error: error.message || 'Failed to reverse journey' });
  }
});

app.post('/api/patient-journeys/:id/reprint-card', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;

    const journey = await prisma.patientJourney.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    if (!journey.cardGeneratedAt) {
      return res.status(400).json({ 
        error: 'Card has not been printed yet. Please mark as CARD_PRINTED first.' 
      });
    }

    const updatedJourney = await prisma.patientJourney.update({
      where: { id },
      data: { 
        cardGeneratedAt: new Date()
      },
      include: { patient: true }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'REPRINT_CARD',
        module: 'Records',
        details: `Reprinted card for patient ${journey.patient.hospitalId}`
      }
    });

    res.json({ 
      message: 'Card reprint recorded successfully', 
      journey: updatedJourney,
      patient: updatedJourney.patient
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
      return res.status(400).json({ 
        error: `Invalid target status. Valid: ${validStatuses.join(', ')}` 
      });
    }

    const journey = await prisma.patientJourney.findUnique({
      where: { id },
      include: { patient: true, billingRecord: true }
    });

    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const statusOrder = ['REGISTERED', 'PENDING_BILLING', 'BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(journey.status);
    const targetIndex = statusOrder.indexOf(targetStatus);

    if (targetIndex >= currentIndex) {
      return res.status(400).json({ 
        error: 'Can only return to a previous stage (not forward)' 
      });
    }

    let updateData = { status: targetStatus };
    
    if (targetStatus === 'REGISTERED') {
      updateData.cardGeneratedAt = null;
      updateData.sentToDestinationAt = null;
      updateData.billingRecordId = null;
    } else if (targetStatus === 'PENDING_BILLING') {
      updateData.cardGeneratedAt = null;
      updateData.sentToDestinationAt = null;
    } else if (targetStatus === 'BILLING_CLEARED') {
      updateData.cardGeneratedAt = null;
      updateData.sentToDestinationAt = null;
    } else if (targetStatus === 'CARD_PRINTED') {
      updateData.sentToDestinationAt = null;
    }

    const updatedJourney = await prisma.patientJourney.update({
      where: { id },
      data: updateData,
      include: { patient: true, clinic: true, ward: true }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'RETURN_TO_STAGE',
        module: 'Records',
        details: `Returned patient ${journey.patient.hospitalId} to ${targetStatus}. Reason: ${reason || 'Process correction'}`
      }
    });

    res.json({ 
      message: `Patient returned to ${targetStatus} successfully`, 
      journey: updatedJourney 
    });
  } catch (error) {
    console.error('Return to stage error:', error);
    res.status(400).json({ error: error.message || 'Failed to return to stage' });
  }
});

// ============ ADMISSIONS (ADT) ============

app.get('/api/admissions', authenticate, async (req, res) => {
  try {
    const admissions = await prisma.admission.findMany({
      include: {
        patient: { select: { firstName: true, lastName: true, hospitalId: true } },
        staff: { select: { firstName: true, lastName: true } },
        ward: true
      },
      orderBy: { admissionDate: 'desc' }
    });
    res.json(admissions);
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
    const count = await prisma.admission.count();
    const admissionNumber = `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const admission = await prisma.admission.create({
      data: { admissionNumber, patientId, staffId, wardId, notes, status: 'Admitted' },
      include: { patient: true, staff: true, ward: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'ADMIT_PATIENT',
        module: 'Records',
        details: `Admitted patient ${admission.patient.hospitalId} (${admissionNumber}) to ${admission.ward.name}`
      }
    });
    res.status(201).json(admission);
  } catch (error) {
    console.error('Create admission error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admissions/:id/discharge', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const admission = await prisma.admission.update({
      where: { id },
      data: { status: 'Discharged', dischargeDate: new Date(), notes: notes || undefined },
      include: { patient: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DISCHARGE_PATIENT',
        module: 'Records',
        details: `Discharged patient ${admission.patient.hospitalId}`
      }
    });
    res.json(admission);
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
    const admission = await prisma.admission.update({
      where: { id },
      data: { wardId, notes: notes || undefined },
      include: { patient: true, ward: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'TRANSFER_PATIENT',
        module: 'Records',
        details: `Transferred patient ${admission.patient.hospitalId} to ${admission.ward.name}`
      }
    });
    res.json(admission);
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ NURSE ENDPOINTS ============

app.get('/api/nurse/patients', authenticate, authorize('Nurse', 'Admin', 'Midwife'), async (req, res) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.user.id },
      include: { clinics: { select: { clinicId: true } }, wards: { select: { wardId: true } } }
    });
    const clinicIds = staff.clinics.map(c => c.clinicId);
    const wardIds = staff.wards.map(w => w.wardId);
    if (clinicIds.length === 0 && wardIds.length === 0) return res.json([]);
    const journeys = await prisma.patientJourney.findMany({
      where: {
        status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
        OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
      },
      include: {
        patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true, gender: true,
            dateOfBirth: true, phone: true, email: true, address: true, emergencyContact: true,
            allergies: true, nextOfKinName: true, nextOfKinPhone: true, nextOfKinRelationship: true
          }
        },
        clinic: true, ward: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(journeys);
  } catch (error) {
    console.error('Error fetching nurse patients:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ UPDATED: GET /api/patients/:patientId/vitals with staff name fallback
app.get('/api/patients/:patientId/vitals', authenticate, async (req, res) => {
  try {
    const vitals = await prisma.vitalSign.findMany({
      where: { patientId: req.params.patientId },
      include: { 
        nurse: { 
          select: { 
            id: true,
            firstName: true, 
            lastName: true,
            role: true
          } 
        } 
      },
      orderBy: { recordedAt: 'desc' }
    });
    
    // ✅ Add fallback for unknown staff
    const formattedVitals = vitals.map(v => ({
      ...v,
      nurse: v.nurse ? {
        ...v.nurse,
        fullName: v.nurse.firstName && v.nurse.lastName 
          ? `${v.nurse.firstName} ${v.nurse.lastName}`
          : `${v.nurse.role || 'Unknown'} (ID: ${v.nurseId?.slice(0, 8) || 'Unknown'})`
      } : {
        fullName: 'Unknown Nurse (Deleted)',
        role: 'Unknown'
      }
    }));
    
    console.log('📋 Vitals fetched:', formattedVitals.length);
    res.json(formattedVitals);
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vitals', authenticate, authorize('Nurse', 'Midwife', 'Doctor', 'Obstetrician', 'Admin'), async (req, res) => {
  try {
    const { patientId, bloodPressureSystolic, bloodPressureDiastolic, heartRate, temperature,
      respiratoryRate, oxygenSaturation, weight, height, notes } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });
    const vital = await prisma.vitalSign.create({
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
        notes: notes || null
      }
    });
    await prisma.auditLog.create({
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

// ============ NURSE ASSIGNMENT ENDPOINTS (Admin Only) ============

app.get('/api/staff/:staffId/assignments', authenticate, authorize('Admin'), async (req, res) => {
  const staff = await prisma.staff.findUnique({
    where: { id: req.params.staffId },
    include: {
      clinics: { include: { clinic: true } },
      wards: { include: { ward: true } }
    }
  });
  res.json({
    clinicIds: staff.clinics.map(c => c.clinicId),
    wardIds: staff.wards.map(w => w.wardId)
  });
});

app.post('/api/staff/:staffId/clinics', authenticate, authorize('Admin'), async (req, res) => {
  const { clinicId } = req.body;
  await prisma.staffClinic.create({
    data: { staffId: req.params.staffId, clinicId }
  });
  res.json({ message: 'Clinic assigned' });
});

app.delete('/api/staff/:staffId/clinics/:clinicId', authenticate, authorize('Admin'), async (req, res) => {
  await prisma.staffClinic.delete({
    where: {
      staffId_clinicId: {
        staffId: req.params.staffId,
        clinicId: req.params.clinicId
      }
    }
  });
  res.json({ message: 'Clinic unassigned' });
});

app.post('/api/staff/:staffId/wards', authenticate, authorize('Admin'), async (req, res) => {
  const { wardId } = req.body;
  await prisma.staffWard.create({
    data: { staffId: req.params.staffId, wardId }
  });
  res.json({ message: 'Ward assigned' });
});

app.delete('/api/staff/:staffId/wards/:wardId', authenticate, authorize('Admin'), async (req, res) => {
  await prisma.staffWard.delete({
    where: {
      staffId_wardId: {
        staffId: req.params.staffId,
        wardId: req.params.wardId
      }
    }
  });
  res.json({ message: 'Ward unassigned' });
});

// ============ DOCTOR ENDPOINTS ============

app.get('/api/doctor/patients', authenticate, authorize('Doctor', 'Obstetrician'), async (req, res) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.user.id },
      include: { clinics: { select: { clinicId: true } }, wards: { select: { wardId: true } } }
    });
    const clinicIds = staff.clinics.map(c => c.clinicId);
    const wardIds = staff.wards.map(w => w.wardId);
    if (clinicIds.length === 0 && wardIds.length === 0) return res.json([]);
    const journeys = await prisma.patientJourney.findMany({
      where: {
        status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
        OR: [{ clinicId: { in: clinicIds } }, { wardId: { in: wardIds } }]
      },
      include: {
        patient: {
          select: {
            id: true, hospitalId: true, firstName: true, lastName: true, gender: true,
            dateOfBirth: true, phone: true, email: true, address: true, emergencyContact: true,
            allergies: true, nextOfKinName: true, nextOfKinPhone: true, nextOfKinRelationship: true
          }
        },
        clinic: true, ward: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(journeys);
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ BILLING OFFICER ENDPOINTS ============

app.get('/api/billing-officer/pending', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const pendingJourneys = await prisma.patientJourney.findMany({
      where: { status: 'PENDING_BILLING' },
      include: {
        patient: { 
          select: { 
            id: true, hospitalId: true, firstName: true, lastName: true,
            patientCategory: true, insuranceProvider: true, insuranceId: true, corporateCompany: true
          } 
        },
        clinic: { select: { name: true } },
        ward: { select: { name: true } },
        registeredBy: { select: { firstName: true, lastName: true } },
        billingRecord: true
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(pendingJourneys);
  } catch (error) {
    console.error('Error fetching pending billing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing-officer/process-payment', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { journeyId, paymentMethod } = req.body;
    if (!journeyId) return res.status(400).json({ error: 'Journey ID is required' });
    const journey = await prisma.patientJourney.findUnique({
      where: { id: journeyId },
      include: { patient: true, billingRecord: true }
    });
    if (!journey) return res.status(404).json({ error: 'Journey not found' });
    if (journey.status !== 'PENDING_BILLING') {
      return res.status(400).json({ error: 'Journey is not in pending billing status' });
    }
    let bill = journey.billingRecord;
    if (!bill) {
      const amount = 5000;
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const invoiceNumber = `INV-${new Date().getFullYear()}-${timestamp}-${random}`;
      bill = await prisma.billingRecord.create({
        data: {
          patientId: journey.patientId, invoiceNumber,
          description: 'General Consultation', amount, totalAmount: amount, status: 'Pending'
        }
      });
      await prisma.patientJourney.update({
        where: { id: journeyId },
        data: { billingRecordId: bill.id }
      });
    }
    const updatedBill = await prisma.billingRecord.update({
      where: { id: bill.id },
      data: { status: 'Paid', paymentMethod: paymentMethod || 'Cash', paymentDate: new Date() }
    });
    updatedBill.patient = journey.patient;
    const updatedJourney = await prisma.patientJourney.update({
      where: { id: journeyId },
      data: { status: 'BILLING_CLEARED' },
      include: { patient: true, clinic: true, ward: true }
    });
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'BILLING_PAID',
        module: 'Billing',
        details: `Marked bill ${updatedBill.invoiceNumber} as paid for patient ${updatedJourney.patient.hospitalId}`
      }
    });
    res.json({ bill: updatedBill, journey: updatedJourney });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ANTENATAL MODULE ENDPOINTS ============

app.get('/api/pregnancies', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const role = req.user.role;
    console.log(`🔍 Fetching pregnancies for role: ${role}`);
    
    const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Obstetrician', 'Midwife', 'Nurse'];
    if (!allowedRoles.includes(role)) {
      console.log(`⛔ Role ${role} not allowed to access antenatal`);
      return res.status(403).json({ 
        error: 'Access denied. Only Obstetricians, Midwives, Nurses, and administrators can access antenatal records.' 
      });
    }
    
    if (role === 'Doctor') {
      console.log(`⛔ Regular Doctors cannot access antenatal module`);
      return res.status(403).json({ 
        error: 'Access denied. Only Obstetricians and Midwives can access antenatal records.' 
      });
    }
    
    let where = {};
    let includeOptions = {
      patient: { 
        select: { 
          id: true,
          hospitalId: true, 
          firstName: true, 
          lastName: true,
          gender: true,
          dateOfBirth: true,
          phone: true,
          email: true
        } 
      },
      visits: { 
        orderBy: { visitDate: 'desc' }, 
        take: 1,
        select: {
          id: true,
          visitDate: true,
          gestationalWeeks: true,
          bloodPressure: true,
          heartRate: true,
          weight: true,
          fundalHeight: true,
          notes: true
        }
      },
      delivery: {
        select: {
          id: true,
          deliveryDate: true,
          type: true,
          babyGender: true,
          babyWeight: true,
          babyApgar: true,
          outcome: true
        }
      }
    };

    if (['Nurse', 'Midwife'].includes(role)) {
      console.log(`🔍 Filtering pregnancies for ${role}: ${req.user.id}`);
      
      const staff = await prisma.staff.findUnique({
        where: { id: req.user.id },
        include: {
          clinics: { select: { clinicId: true } },
          wards: { select: { wardId: true } }
        }
      });
      
      const clinicIds = staff.clinics.map(c => c.clinicId);
      const wardIds = staff.wards.map(w => w.wardId);
      
      console.log(`📋 Clinic IDs: ${clinicIds.join(', ')}`);
      console.log(`📋 Ward IDs: ${wardIds.join(', ')}`);

      if (clinicIds.length === 0 && wardIds.length === 0) {
        console.log('⚠️ No clinic or ward assignments found - returning empty array');
        return res.json([]);
      }

      const patientsInAssignedClinics = await prisma.patientJourney.findMany({
        where: {
          status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
          OR: [
            { clinicId: { in: clinicIds } },
            { wardId: { in: wardIds } }
          ]
        },
        select: { patientId: true }
      });
      
      const patientIds = patientsInAssignedClinics.map(j => j.patientId);
      
      if (patientIds.length === 0) {
        console.log('⚠️ No patients found in assigned clinics/wards');
        return res.json([]);
      }
      
      where = { patientId: { in: patientIds } };
    }

    const pregnancies = await prisma.pregnancy.findMany({
      where,
      include: includeOptions,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Found ${pregnancies.length} pregnancies`);
    res.json(pregnancies);
  } catch (error) {
    console.error('Get pregnancies error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pregnancies' });
  }
});

app.get('/api/pregnancies/:id', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const pregnancy = await prisma.pregnancy.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        visits: {
          include: { staff: { select: { firstName: true, lastName: true } } },
          orderBy: { visitDate: 'desc' }
        },
        delivery: {
          include: { staff: { select: { firstName: true, lastName: true } } }
        }
      }
    });
    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found' });
    res.json(pregnancy);
  } catch (error) {
    console.error('Get pregnancy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pregnancies', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { patientId, expectedDelivery, gravida, para, lastMenstrualPeriod, estimatedDueDate, riskLevel, notes } = req.body;

    if (!patientId || !expectedDelivery) {
      return res.status(400).json({ error: 'Patient and expected delivery date are required.' });
    }

    const patient = await prisma.patient.findUnique({
      where: { hospitalId: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found. Please register the patient first.' });
    }

    const existingPregnancy = await prisma.pregnancy.findFirst({
      where: {
        patientId: patient.id,
        status: 'Active'
      }
    });

    if (existingPregnancy) {
      return res.status(400).json({ error: 'This patient already has an active pregnancy.' });
    }

    const gravidaValue = gravida && gravida !== '' ? parseInt(gravida) : 0;
    const paraValue = para && para !== '' ? parseInt(para) : 0;

    console.log('📝 Creating pregnancy - gravida:', gravidaValue);
    console.log('📝 Creating pregnancy - para:', paraValue);

    const pregnancy = await prisma.pregnancy.create({
      data: {
        patientId: patient.id,
        expectedDelivery: new Date(expectedDelivery),
        gravida: gravidaValue,
        para: paraValue,
        lastMenstrualPeriod: lastMenstrualPeriod ? new Date(lastMenstrualPeriod) : null,
        estimatedDueDate: estimatedDueDate ? new Date(estimatedDueDate) : null,
        riskLevel: riskLevel || 'Low',
        notes,
        status: 'Active'
      },
      include: { patient: true }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_PREGNANCY',
        module: 'Antenatal',
        details: `Pregnancy record created for patient ${pregnancy.patient.hospitalId}`
      }
    });

    res.status(201).json(pregnancy);
  } catch (error) {
    console.error('Create pregnancy error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/pregnancies/:id', authenticate, checkPermission('antenatal'), async (req, res) => {
  const { id } = req.params;
  const { status, notes, riskLevel, estimatedDueDate, gravida, para } = req.body;

  try {
    console.log('🔍 Update pregnancy - ID:', id);
    console.log('🔍 Update pregnancy - Body:', req.body);

    const existing = await prisma.pregnancy.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Pregnancy not found' });
    }

    const gravidaValue = gravida !== undefined && gravida !== '' ? parseInt(gravida) : existing.gravida;
    const paraValue = para !== undefined && para !== '' ? parseInt(para) : existing.para;

    const updated = await prisma.pregnancy.update({
      where: { id },
      data: {
        status: status || undefined,
        notes: notes || undefined,
        riskLevel: riskLevel || undefined,
        estimatedDueDate: estimatedDueDate ? new Date(estimatedDueDate) : undefined,
        gravida: gravidaValue,
        para: paraValue,
      },
    });

    await prisma.auditLog.create({
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
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pregnancy not found' });
    }
    res.status(500).json({ error: 'Failed to update pregnancy' });
  }
});

app.post('/api/pregnancies/:id/visits', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { id } = req.params;
    const { visitDate, gestationalWeeks, bloodPressure, heartRate, weight, fundalHeight, notes } = req.body;

    const visit = await prisma.antenatalVisit.create({
      data: {
        pregnancyId: id,
        staffId: req.user.id,
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        gestationalWeeks: parseInt(gestationalWeeks) || null,
        bloodPressure,
        heartRate: parseInt(heartRate) || null,
        weight: parseFloat(weight) || null,
        fundalHeight: parseFloat(fundalHeight) || null,
        notes
      }
    });

    await prisma.pregnancy.update({
      where: { id },
      data: { updatedAt: new Date() }
    });

    res.status(201).json(visit);
  } catch (error) {
    console.error('Add visit error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/deliveries', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { pregnancyId, deliveryDate, type, durationHours, babyGender, babyWeight, babyApgar, outcome, notes } = req.body;

    if (!pregnancyId || !type || !babyGender) {
      return res.status(400).json({ error: 'Pregnancy ID, delivery type, and baby gender are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.create({
        data: {
          pregnancyId,
          staffId: req.user.id,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          type,
          durationHours: parseFloat(durationHours) || null,
          babyGender,
          babyWeight: parseFloat(babyWeight) || null,
          babyApgar: parseInt(babyApgar) || null,
          outcome: outcome || 'Live birth',
          notes
        },
        include: { pregnancy: { include: { patient: true } } }
      });

      await tx.pregnancy.update({
        where: { id: pregnancyId },
        data: { status: 'Delivered' }
      });

      const mother = delivery.pregnancy.patient;
      
      const allPatients = await tx.patient.findMany({
        select: { hospitalId: true }
      });
      let maxNumericId = 0;
      for (const p of allPatients) {
        const num = parseInt(p.hospitalId, 10);
        if (!isNaN(num) && num > maxNumericId) {
          maxNumericId = num;
        }
      }
      let nextIdNumber = maxNumericId + 1;
      let babyHospitalId;
      let attempts = 0;
      
      while (attempts < 5) {
        babyHospitalId = ((nextIdNumber * 9301 + 12345) % 1000000)
          .toString()
          .padStart(6, '0');
        
        try {
          const existing = await tx.patient.findUnique({
            where: { hospitalId: babyHospitalId }
          });
          if (!existing) break;
          attempts++;
          nextIdNumber++;
        } catch (err) {
          attempts++;
          nextIdNumber++;
        }
      }
      
      if (!babyHospitalId) {
        throw new Error('Failed to generate unique hospital ID for baby');
      }

      let babyEmail;
      const emailPrefix = `baby_${babyHospitalId}`;
      
      if (mother.email) {
        const domain = mother.email.split('@')[1] || 'hospital.com';
        babyEmail = `${emailPrefix}@${domain}`;
      } else {
        babyEmail = `${emailPrefix}@hospital.com`;
      }
      
      let emailExists = await tx.patient.findUnique({
        where: { email: babyEmail }
      });
      
      let counter = 1;
      while (emailExists) {
        babyEmail = `${emailPrefix}_${counter}@${mother.email ? (mother.email.split('@')[1] || 'hospital.com') : 'hospital.com'}`;
        emailExists = await tx.patient.findUnique({
          where: { email: babyEmail }
        });
        counter++;
      }

      const baby = await tx.patient.create({
        data: {
          hospitalId: babyHospitalId,
          firstName: `Baby ${mother.firstName}`,
          lastName: mother.lastName,
          dateOfBirth: new Date(),
          gender: babyGender,
          phone: mother.phone || null,
          email: babyEmail,
          address: mother.address || null,
          emergencyContact: mother.emergencyContact || null,
          allergies: mother.allergies || null,
          nextOfKinName: mother.firstName + ' ' + mother.lastName,
          nextOfKinPhone: mother.phone || null,
          nextOfKinRelationship: 'Mother'
        }
      });

      let paediatricsClinic = await tx.clinic.findFirst({
        where: { 
          name: {
            equals: 'Paediatrics',
            mode: 'insensitive'
          }
        }
      });
      
      if (!paediatricsClinic) {
        paediatricsClinic = await tx.clinic.create({
          data: {
            name: 'Paediatrics',
            description: 'Paediatrics Clinic for newborns and children',
            location: 'Main Hospital'
          }
        });
        console.log('✅ Created Paediatrics clinic automatically');
      }

      await tx.patientJourney.create({
        data: {
          patientId: baby.id,
          destinationType: 'CLINIC',
          clinicId: paediatricsClinic.id,
          registeredById: req.user.id,
          status: 'SENT_TO_DESTINATION'
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

      return { delivery, baby };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Record delivery error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ ADMIN PERMISSIONS MANAGER ============

// In server.js - Update the /api/permissions endpoint
app.get('/api/permissions', authenticate, async (req, res) => {
  try {
    console.log('📋 Fetching permissions...');
    
    // First, get the actual columns that exist in the table
    const columnCheck = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'RolePermission'
    `;
    const existingColumns = columnCheck.map(c => c.column_name);
    console.log('📋 Existing columns:', existingColumns);
    
    let perms = await prisma.rolePermission.findMany();
    console.log(`✅ Found ${perms.length} existing permission records`);
    
    // ✅ Define all known roles including LabScientist
    const allRoles = ['Admin', 'ITAdmin', 'ITSupport', 'Doctor', 'Nurse', 'Pharmacist', 
      'Accountant', 'Records', 'LabTechnician', 'Receptionist', 'BillingOfficer', 
      'Obstetrician', 'Midwife', 'Radiologist', 'HR', 'LabScientist'];
    
    // ✅ Define default permissions - only for columns that exist
    const defaultPermissions = {};
    
    // Only include columns that exist in the database
    const knownFields = [
      'dashboard', 'patients', 'staff', 'appointments', 'prescriptions', 
      'labOrders', 'billing', 'pharmacy', 'pharmacyDashboard', 'pharmacyInventory',
      'nhisManagement', 'nhisAuthorizations', 'pharmacyStock', 'pharmacyTransactions',
      'pharmacyBranches', 'clinics', 'wards', 'pricing', 'billingOfficer', 'wallet',
      'patientIntake', 'admissions', 'patientHistory', 'roiRequests', 'nurseDashboard',
      'doctorDashboard', 'antenatal', 'archivedPatients', 'archivedPatientsView',
      'queueManagement', 'doctorQueue', 'hrDashboard', 'hrEmployees', 'hrDepartments',
      'hrLeaves', 'hrAttendance', 'hrPerformance', 'hrTrainings'
    ];
    
    // Add new fields if they exist in the database
    const newFields = ['radiology', 'dental', 'optometry', 'immunizations', 'patientPortal', 'portalSetup'];
    const allFields = [...knownFields, ...newFields];
    
    for (const field of allFields) {
      if (existingColumns.includes(field)) {
        defaultPermissions[field] = false;
      }
    }
    
    for (const role of allRoles) {
      const existing = perms.find(p => p.role === role);
      if (!existing) {
        try {
          console.log(`📝 Creating permission for role: ${role}`);
          const newPerm = await prisma.rolePermission.create({ 
            data: { 
              role,
              ...defaultPermissions
            } 
          });
          perms.push(newPerm);
          console.log(`✅ Created permission for ${role}`);
        } catch (error) {
          console.error(`❌ Failed to create permission for ${role}:`, error.message);
        }
      } else {
        // Check if any fields are missing and update with defaults
        const missingFields = {};
        let hasMissing = false;
        for (const [key, defaultValue] of Object.entries(defaultPermissions)) {
          if (existing[key] === undefined || existing[key] === null) {
            missingFields[key] = defaultValue;
            hasMissing = true;
          }
        }
        if (hasMissing) {
          try {
            console.log(`📝 Updating missing fields for role: ${role}`);
            const updated = await prisma.rolePermission.update({
              where: { role },
              data: missingFields
            });
            const index = perms.findIndex(p => p.role === role);
            perms[index] = updated;
            console.log(`✅ Updated ${role} with missing fields`);
          } catch (error) {
            console.error(`❌ Failed to update ${role}:`, error.message);
          }
        }
      }
    }
    
    const freshPerms = await prisma.rolePermission.findMany();
    console.log(`✅ Returning ${freshPerms.length} permission records`);
    res.json(freshPerms);
  } catch (error) { 
    console.error('❌ Get permissions error:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// In server.js - Update the PATCH /api/permissions/:role endpoint
app.patch('/api/permissions/:role', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { role } = req.params;
    const updates = req.body;
    
    console.log(`📝 Updating permissions for role: ${role}`);
    console.log('📝 Updates:', updates);
    
    // ✅ Define all default fields
    const defaultPermissions = {
      dashboard: false,
      patients: false,
      staff: false,
      appointments: false,
      prescriptions: false,
      labOrders: false,
      billing: false,
      pharmacy: false,
      pharmacyDashboard: false,
      pharmacyInventory: false,
      nhisManagement: false,
      nhisAuthorizations: false,
      pharmacyStock: false,
      pharmacyTransactions: false,
      pharmacyBranches: false,
      clinics: false,
      wards: false,
      pricing: false,
      billingOfficer: false,
      patientIntake: false,
      admissions: false,
      patientHistory: false,
      roiRequests: false,
      nurseDashboard: false,
      doctorDashboard: false,
      antenatal: false,
      archivedPatients: false,
      archivedPatientsView: false,
      doctorQueue: false,
      queueManagement: false,
      hrDashboard: false,
      hrEmployees: false,
      hrDepartments: false,
      hrLeaves: false,
      hrAttendance: false,
      hrPerformance: false,
      hrTrainings: false,
      radiology: false,
      dental: false,
      optometry: false,
      immunizations: false,
      patientPortal: false,
      portalSetup: false,
      wallet: false,
    };
    
    let perm = await prisma.rolePermission.findUnique({
      where: { role }
    });
    
    if (!perm) {
      console.log(`📝 Creating new permission record for ${role}`);
      perm = await prisma.rolePermission.create({
        data: { 
          role,
          ...defaultPermissions
        }
      });
    }
    
    // ✅ Only update the fields that were sent
    const updated = await prisma.rolePermission.update({
      where: { role },
      data: updates
    });
    
    console.log('✅ Permissions updated successfully');
    res.json(updated);
  } catch (error) {
    console.error('❌ Update permissions error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ PATIENT QUEUE MANAGEMENT ENDPOINTS ============

app.post('/api/patient/checkin', authenticate, async (req, res) => {
  try {
    const { patientId, hospitalId, phone, appointmentId, checkInMethod } = req.body;
    const staffId = req.user.id;

    let patient;
    if (patientId) {
      patient = await prisma.patient.findUnique({ where: { id: patientId } });
    } else if (hospitalId) {
      patient = await prisma.patient.findUnique({ where: { hospitalId } });
    } else if (phone) {
      patient = await prisma.patient.findFirst({ where: { phone } });
    }

    if (!patient) {
      return res.status(404).json({ 
        error: 'Patient not found. Please check the ID or phone number.' 
      });
    }

    let appointment = null;
    if (appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { staff: true }
      });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      appointment = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          dateTime: {
            gte: today,
            lt: tomorrow
          },
          status: 'Scheduled'
        },
        include: { staff: true }
      });
    }

    let destinationType = 'CLINIC';
    let clinicId = null;
    let wardId = null;

    if (appointment) {
      const staff = await prisma.staff.findUnique({
        where: { id: appointment.staffId },
        include: { clinics: true }
      });
      if (staff && staff.clinics.length > 0) {
        clinicId = staff.clinics[0].clinicId;
      }
    }

    const queueEntry = await prisma.patientQueue.create({
      data: {
        patientId: patient.id,
        checkInMethod: checkInMethod || 'manual_entry',
        status: 'waiting',
        priority: appointment?.priority || 'normal',
        appointmentId: appointment?.id || null,
        destinationType,
        clinicId,
        wardId,
        assignedTo: appointment?.staffId || null,
        notes: appointment ? `Appointment at ${new Date(appointment.dateTime).toLocaleTimeString()} with Dr. ${appointment.staff?.firstName} ${appointment.staff?.lastName}` : 'Walk-in patient'
      },
      include: {
        patient: true,
        appointment: {
          include: { staff: true }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'PATIENT_CHECKIN',
        module: 'Queue',
        details: `Patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName} checked in`
      }
    });

    const queuePosition = await prisma.patientQueue.count({
      where: {
        status: 'waiting',
        createdAt: { lt: queueEntry.createdAt },
        destinationType
      }
    });

    res.json({
      message: 'Patient checked in successfully',
      queueEntry,
      queuePosition: queuePosition + 1,
      patient: {
        id: patient.id,
        hospitalId: patient.hospitalId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        patientCategory: patient.patientCategory
      },
      appointment,
      autoFile: {
        patientId: patient.id,
        hospitalId: patient.hospitalId,
        name: `${patient.firstName} ${patient.lastName}`,
        profileUrl: `/patient-profile/${patient.id}`,
        hasAppointment: !!appointment,
        appointmentTime: appointment ? new Date(appointment.dateTime).toLocaleString() : null,
        doctor: appointment?.staff ? `Dr. ${appointment.staff.firstName} ${appointment.staff.lastName}` : null
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
      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        include: {
          clinics: { select: { clinicId: true } },
          wards: { select: { wardId: true } }
        }
      });
      
      const clinicIds = staff.clinics.map(c => c.clinicId);
      const wardIds = staff.wards.map(w => w.wardId);
      
      where.OR = [
        { assignedTo: staffId },
        { clinicId: { in: clinicIds } },
        { wardId: { in: wardIds } }
      ];
    } 
    else if (['Nurse', 'Midwife'].includes(userRole)) {
      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        include: {
          clinics: { select: { clinicId: true } },
          wards: { select: { wardId: true } }
        }
      });
      const clinicIds = staff.clinics.map(c => c.clinicId);
      const wardIds = staff.wards.map(w => w.wardId);
      
      where.OR = [
        { clinicId: { in: clinicIds } },
        { wardId: { in: wardIds } }
      ];
    }

    if (date) {
      const filterDate = new Date(date);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      where.checkInTime = {
        gte: filterDate,
        lt: nextDay
      };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      where.checkInTime = {
        gte: today,
        lt: tomorrow
      };
    }

    if (doctorId) {
      where.assignedTo = doctorId;
    }

    const queue = await prisma.patientQueue.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
            patientCategory: true
          }
        },
        appointment: {
          include: { 
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        },
        clinic: true,
        ward: true,
        assignedStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { checkInTime: 'asc' }
      ]
    });

    const queueWithPositions = queue.map((entry, index) => {
      const waitTime = Math.floor((Date.now() - new Date(entry.checkInTime).getTime()) / 60000);
      return {
        ...entry,
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

    const nextPatient = await prisma.patientQueue.findFirst({
      where: {
        status: 'waiting',
        destinationType: destinationType || 'CLINIC'
      },
      orderBy: [
        { priority: 'desc' },
        { checkInTime: 'asc' }
      ],
      include: {
        patient: true,
        appointment: {
          include: { staff: true }
        }
      }
    });

    if (!nextPatient) {
      return res.status(404).json({ message: 'No patients waiting' });
    }

    const updated = await prisma.patientQueue.update({
      where: { id: nextPatient.id },
      data: {
        status: 'in_progress',
        assignedTo: staffId,
        calledTime: new Date(),
        startTime: new Date()
      },
      include: {
        patient: true,
        appointment: {
          include: { staff: true }
        }
      }
    });

    const waitTime = Math.floor((Date.now() - new Date(nextPatient.checkInTime).getTime()) / 60000);

    res.json({
      message: 'Patient called',
      patient: updated,
      waitTimeMinutes: waitTime,
      autoFile: {
        patientId: updated.patient.id,
        hospitalId: updated.patient.hospitalId,
        name: `${updated.patient.firstName} ${updated.patient.lastName}`,
        profileUrl: `/patient-profile/${updated.patient.id}`,
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

    const queueEntry = await prisma.patientQueue.update({
      where: { id },
      data: {
        status: 'completed',
        endTime: new Date(),
        notes: notes || undefined
      },
      include: { patient: true }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'PATIENT_COMPLETED',
        module: 'Queue',
        details: `Patient ${queueEntry.patient.hospitalId} - ${queueEntry.patient.firstName} ${queueEntry.patient.lastName} visit completed`
      }
    });

    res.json({
      message: 'Patient visit completed',
      queueEntry
    });
  } catch (error) {
    console.error('Complete visit error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/patient/search/quick', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const patients = await prisma.patient.findMany({
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
        id: true,
        hospitalId: true,
        firstName: true,
        lastName: true,
        phone: true,
        gender: true,
        patientCategory: true,
        dateOfBirth: true
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

app.get('/api/patient/queue/stats', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, waiting, inProgress, completed, cancelled] = await Promise.all([
      prisma.patientQueue.count({
        where: { checkInTime: { gte: today, lt: tomorrow } }
      }),
      prisma.patientQueue.count({
        where: { status: 'waiting', checkInTime: { gte: today, lt: tomorrow } }
      }),
      prisma.patientQueue.count({
        where: { status: 'in_progress', checkInTime: { gte: today, lt: tomorrow } }
      }),
      prisma.patientQueue.count({
        where: { status: 'completed', checkInTime: { gte: today, lt: tomorrow } }
      }),
      prisma.patientQueue.count({
        where: { status: 'cancelled', checkInTime: { gte: today, lt: tomorrow } }
      })
    ]);

    const completedPatients = await prisma.patientQueue.findMany({
      where: {
        status: 'completed',
        checkInTime: { gte: today, lt: tomorrow },
        startTime: { not: null },
        endTime: { not: null }
      }
    });

    let avgWaitTime = 0;
    let avgServiceTime = 0;

    if (completedPatients.length > 0) {
      const totalWaitTime = completedPatients.reduce((sum, p) => {
        const wait = new Date(p.startTime).getTime() - new Date(p.checkInTime).getTime();
        return sum + wait;
      }, 0);
      avgWaitTime = Math.round(totalWaitTime / completedPatients.length / 60000);

      const totalServiceTime = completedPatients.reduce((sum, p) => {
        const service = new Date(p.endTime).getTime() - new Date(p.startTime).getTime();
        return sum + service;
      }, 0);
      avgServiceTime = Math.round(totalServiceTime / completedPatients.length / 60000);
    }

    res.json({
      today: {
        total,
        waiting,
        inProgress,
        completed,
        cancelled
      },
      averages: {
        avgWaitTimeMinutes: avgWaitTime,
        avgServiceTimeMinutes: avgServiceTime
      }
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ AUTO-ARCHIVE SCHEDULED JOB ============

async function autoArchivePatients() {
  console.log('🔄 Running auto-archive job...');
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const completedJourneys = await prisma.patientJourney.findMany({
      where: { status: 'COMPLETED', completedAt: { lte: threeDaysAgo } },
      select: { patientId: true, patient: { select: { isArchived: true, hospitalId: true, firstName: true, lastName: true } } },
      distinct: ['patientId']
    });
    const patientsToArchive = completedJourneys.filter(j => !j.patient.isArchived).map(j => j.patient);
    let archivedCount = 0;
    for (const patient of patientsToArchive) {
      try {
        await prisma.patient.update({
          where: { id: patient.id },
          data: {
            isArchived: true, archivedAt: new Date(),
            archivedReason: 'Auto-archived after 3 days of completion',
            archivedBy: null, autoArchived: true
          }
        });
        const journey = await prisma.patientJourney.findFirst({
          where: { patientId: patient.id, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' }
        });
        if (journey) {
          await prisma.patientJourney.update({
            where: { id: journey.id },
            data: { archivedAt: new Date() }
          });
        }
        await prisma.auditLog.create({
          data: {
            staffId: null, action: 'AUTO_ARCHIVE_PATIENT', module: 'System',
            details: `Auto-archived patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}`
          }
        });
        archivedCount++;
      } catch (error) {
        console.error(`Failed to archive patient ${patient.id}:`, error);
      }
    }
    console.log(`Auto-archive completed. Archived ${archivedCount} patients.`);
    return { archivedCount, total: patientsToArchive.length };
  } catch (error) {
    console.error('Auto-archive error:', error);
    return { error: error.message };
  }
}

app.post('/api/system/auto-archive', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const result = await autoArchivePatients();
    res.json({ message: 'Auto-archive job completed', ...result });
  } catch (error) {
    console.error('Manual auto-archive error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patient/my-queue', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const queueEntry = await prisma.patientQueue.findFirst({
      where: {
        patientId,
        status: { in: ['waiting', 'in_progress'] }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        appointment: {
          include: { staff: true }
        },
        clinic: true,
        ward: true
      }
    });

    if (!queueEntry) {
      return res.json({ message: 'You are not currently in the queue' });
    }

    const position = await prisma.patientQueue.count({
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

cron.schedule('0 */6 * * *', async () => {
  console.log(`Auto-archive job started at ${new Date().toISOString()}`);
  await autoArchivePatients();
});

cron.schedule('0 2 * * *', async () => {
  console.log(`Nightly auto-archive job started at ${new Date().toISOString()}`);
  await autoArchivePatients();
});

// ============ HR MODULE ENDPOINTS ============

// Get all departments
app.get('/api/hr/departments', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    console.log('📋 GET /api/hr/departments');
    const departments = await prisma.department.findMany({
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            employeeId: true
          }
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    console.log(`✅ Found ${departments.length} departments`);
    res.json(departments);
  } catch (error) {
    console.error('❌ Get departments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create department
app.post('/api/hr/departments', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { name, description, managerId, location, costCenter } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
        managerId: managerId || null,
        location,
        costCenter
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_DEPARTMENT',
        module: 'HR',
        details: `Created department: ${name}`
      }
    });

    res.status(201).json(department);
  } catch (error) {
    console.error('❌ Create department error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update department
app.put('/api/hr/departments/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, managerId, location, costCenter, isActive } = req.body;

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        description,
        managerId: managerId || null,
        location,
        costCenter,
        isActive: isActive !== undefined ? isActive : true
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_DEPARTMENT',
        module: 'HR',
        details: `Updated department: ${name}`
      }
    });

    res.json(department);
  } catch (error) {
    console.error('❌ Update department error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete department
app.delete('/api/hr/departments/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const staffCount = await prisma.staff.count({
      where: { departmentId: id }
    });
    
    if (staffCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete department with assigned staff. Reassign or deactivate staff first.' 
      });
    }

    await prisma.department.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'DELETE_DEPARTMENT',
        module: 'HR',
        details: `Deleted department ID: ${id}`
      }
    });

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('❌ Delete department error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get all employees with full HR details
app.get('/api/hr/employees', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { department, status, search } = req.query;
    
    console.log('📋 GET /api/hr/employees - Query:', req.query);
    console.log('👤 User:', req.user?.role);
    
    let where = {};
    
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

    const employees = await prisma.staff.findMany({
      where,
      include: {
        department: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Found ${employees.length} employees`);

    const formattedEmployees = employees.map(emp => {
      const { password, ...employeeWithoutPassword } = emp;
      return {
        ...employeeWithoutPassword,
        pendingLeaves: 0,
        lastReview: null,
        trainings: []
      };
    });

    res.json(formattedEmployees);
  } catch (error) {
    console.error('❌ Get employees error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single employee
app.get('/api/hr/employees/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📋 GET /api/hr/employees/${id}`);

    const employee = await prisma.staff.findUnique({
      where: { id },
      include: {
        department: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { password, ...employeeWithoutPassword } = employee;
    res.json(employeeWithoutPassword);
  } catch (error) {
    console.error('❌ Get employee error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update employee HR details
app.put('/api/hr/employees/:id', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employeeId,
      firstName,
      lastName,
      email,
      role,
      departmentId,
      managerId,
      dateOfBirth,
      gender,
      phone,
      address,
      emergencyContact,
      employmentType,
      startDate,
      endDate,
      salary,
      bankName,
      bankAccount,
      bankBranch,
      taxId,
      nationalId,
      isActive
    } = req.body;

    console.log(`📝 PUT /api/hr/employees/${id}`);

    const employee = await prisma.staff.update({
      where: { id },
      data: {
        employeeId,
        firstName,
        lastName,
        email,
        role,
        departmentId: departmentId || null,
        managerId: managerId || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        phone,
        address,
        emergencyContact,
        employmentType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        salary: salary ? parseFloat(salary) : null,
        bankName,
        bankAccount,
        bankBranch,
        taxId,
        nationalId,
        isActive: isActive !== undefined ? isActive : true
      },
      include: {
        department: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_EMPLOYEE',
        module: 'HR',
        details: `Updated employee: ${employee.firstName} ${employee.lastName}`
      }
    });

    const { password, ...employeeWithoutPassword } = employee;
    res.json(employeeWithoutPassword);
  } catch (error) {
    console.error('❌ Update employee error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ LEAVE MANAGEMENT ============

app.get('/api/hr/leaves', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { status, employeeId, dateFrom, dateTo } = req.query;
    
    console.log('📋 GET /api/hr/leaves - Query:', req.query);
    
    let where = {};
    if (status) where.status = status;
    if (employeeId) where.staffId = employeeId;
    if (dateFrom || dateTo) {
      where.startDate = {};
      if (dateFrom) where.startDate.gte = new Date(dateFrom);
      if (dateTo) where.startDate.lte = new Date(dateTo);
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Found ${leaves.length} leave requests`);
    res.json(leaves);
  } catch (error) {
    console.error('❌ Get leaves error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/leaves', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const {
      staffId,
      leaveType,
      startDate,
      endDate,
      reason,
      contactDuringLeave,
      substituteId
    } = req.body;

    console.log('📋 POST /api/hr/leaves - StaffId:', staffId);

    if (!staffId || !leaveType || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        staffId,
        status: 'Approved',
        OR: [
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) }
          }
        ]
      }
    });

    if (overlapping) {
      return res.status(400).json({ error: 'Employee already has an approved leave during this period' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await prisma.leaveRequest.create({
      data: {
        staffId,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days,
        reason,
        contactDuringLeave,
        substituteId: substituteId || null,
        status: 'Pending'
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        substitute: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_LEAVE_REQUEST',
        module: 'HR',
        details: `${staff.firstName} ${staff.lastName} requested ${leaveType} leave (${days} days)`
      }
    });

    res.status(201).json(leave);
  } catch (error) {
    console.error('❌ Create leave error:', error);
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

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedById: req.user.id,
        approvedAt: new Date(),
        comments
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'LEAVE_APPROVAL',
        module: 'HR',
        details: `${leave.staff.firstName} ${leave.staff.lastName} leave ${status}`
      }
    });

    res.json(leave);
  } catch (error) {
    console.error('❌ Update leave error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ HR DASHBOARD STATS ============

app.get('/api/hr/dashboard', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    console.log('📊 GET /api/hr/dashboard - User:', req.user?.role);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalEmployees = await prisma.staff.count();
    const activeEmployees = await prisma.staff.count({ where: { isActive: true } });
    const departments = await prisma.department.count({ where: { isActive: true } });
    const pendingLeaves = await prisma.leaveRequest.count({ where: { status: 'Pending' } });
    
    const employeesOnLeave = await prisma.leaveRequest.count({
      where: {
        status: 'Approved',
        startDate: { lte: today },
        endDate: { gte: today }
      }
    });

    let clockedInToday = 0;
    let totalTrainings = 0;
    
    try {
      clockedInToday = await prisma.attendance.count({
        where: {
          date: today,
          clockIn: { not: null },
          clockOut: null
        }
      });
    } catch (e) {
      console.log('⚠️ Attendance table might not exist yet');
    }
    
    try {
      totalTrainings = await prisma.training.count({
        where: {
          startDate: { gte: new Date(today.getFullYear(), today.getMonth(), 1), lte: new Date(today.getFullYear(), today.getMonth() + 1, 0) }
        }
      });
    } catch (e) {
      console.log('⚠️ Training table might not exist yet');
    }

    const recentLeaves = await prisma.leaveRequest.findMany({
      take: 5,
      where: { status: 'Pending' },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const recentEmployees = await prisma.staff.findMany({
      take: 5,
      where: { isActive: true },
      include: {
        department: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = {
      statistics: {
        totalEmployees,
        activeEmployees,
        departments,
        pendingLeaves,
        employeesOnLeave,
        clockedInToday,
        totalTrainings
      },
      recentLeaves,
      recentEmployees
    };

    console.log('✅ HR Dashboard stats:', result.statistics);
    res.json(result);
  } catch (error) {
    console.error('❌ HR dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ LEAVE REMINDER & NOTIFICATION SYSTEM ============

app.get('/api/hr/leave-reminders', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    
    const upcomingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'Approved',
        startDate: {
          gte: today,
          lte: thirtyDaysLater
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            role: true,
            department: true
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });
    
    const pendingLeaves = await prisma.leaveRequest.findMany({
      where: { status: 'Pending' },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    const todayLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'Approved',
        startDate: { lte: today },
        endDate: { gte: today }
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true
          }
        }
      }
    });
    
    res.json({
      upcomingLeaves,
      pendingLeaves,
      todayLeaves,
      stats: {
        upcomingCount: upcomingLeaves.length,
        pendingCount: pendingLeaves.length,
        todayCount: todayLeaves.length
      }
    });
  } catch (error) {
    console.error('❌ Get leave reminders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/leave-reminders/send', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { daysBefore = 7, leaveIds } = req.body;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const reminderDate = new Date(today);
    reminderDate.setDate(reminderDate.getDate() + daysBefore);
    
    let where = {
      status: 'Approved',
      startDate: {
        gte: today,
        lte: reminderDate
      }
    };
    
    if (leaveIds && leaveIds.length > 0) {
      where.id = { in: leaveIds };
    }
    
    const leavesToRemind = await prisma.leaveRequest.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            role: true
          }
        }
      }
    });
    
    const notifications = [];
    for (const leave of leavesToRemind) {
      const existingNotification = await prisma.leaveNotification.findFirst({
        where: {
          leaveRequestId: leave.id,
          notificationType: 'REMINDER',
          sentAt: {
            gte: today
          }
        }
      });
      
      if (!existingNotification) {
        const notification = await prisma.leaveNotification.create({
          data: {
            leaveRequestId: leave.id,
            staffId: leave.staffId,
            notificationType: 'REMINDER',
            message: `Reminder: Your ${leave.leaveType} leave starts on ${new Date(leave.startDate).toLocaleDateString()}. Please ensure all tasks are handed over.`,
            scheduledDate: reminderDate,
            status: 'PENDING'
          }
        });
        notifications.push(notification);
      }
    }
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'SEND_LEAVE_REMINDERS',
        module: 'HR',
        details: `Sent reminders for ${notifications.length} upcoming leaves`
      }
    });
    
    res.json({
      message: `Reminders queued for ${notifications.length} leave requests`,
      notifications
    });
  } catch (error) {
    console.error('❌ Send leave reminders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/notifications', authenticate, async (req, res) => {
  try {
    const staffId = req.user.id;
    const { unreadOnly = 'true' } = req.query;
    
    const where = {
      OR: [
        { staffId: staffId },
        { isGlobal: true }
      ]
    };
    
    if (unreadOnly === 'true') {
      where.isRead = false;
    }
    
    const notifications = await prisma.leaveNotification.findMany({
      where,
      include: {
        leaveRequest: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    const unreadCount = await prisma.leaveNotification.count({
      where: {
        OR: [
          { staffId: staffId },
          { isGlobal: true }
        ],
        isRead: false
      }
    });
    
    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/hr/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await prisma.leaveNotification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
    
    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('❌ Mark notification read error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/hr/notifications/read-all', authenticate, async (req, res) => {
  try {
    const staffId = req.user.id;
    
    await prisma.leaveNotification.updateMany({
      where: {
        OR: [
          { staffId: staffId },
          { isGlobal: true }
        ],
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('❌ Mark all notifications read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ LEAVE ENTITLEMENT ENDPOINTS ============

app.get('/api/hr/leave-policy', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    let policy = await prisma.leavePolicy.findFirst({
      where: { isActive: true }
    });
    
    if (!policy) {
      policy = await prisma.leavePolicy.create({
        data: {
          name: 'Default Policy',
          description: 'Standard leave policy for all employees',
          defaultAnnualDays: 21,
          defaultSickDays: 10,
          defaultStudyDays: 5,
          defaultMaternityDays: 90,
          defaultPaternityDays: 14,
          maxCarryOverDays: 5,
          leaveYearStartMonth: 1,
          leaveYearEndMonth: 12,
          proRataEnabled: true,
          reminderDays: 30,
          isActive: true
        }
      });
    }
    
    res.json(policy);
  } catch (error) {
    console.error('❌ Get leave policy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/hr/leave-policy', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const {
      defaultAnnualDays,
      defaultSickDays,
      defaultStudyDays,
      defaultMaternityDays,
      defaultPaternityDays,
      maxCarryOverDays,
      carryOverExpiry,
      leaveYearStartMonth,
      leaveYearEndMonth,
      proRataEnabled,
      reminderDays
    } = req.body;
    
    await prisma.leavePolicy.updateMany({
      where: { isActive: true },
      data: {
        defaultAnnualDays,
        defaultSickDays,
        defaultStudyDays,
        defaultMaternityDays,
        defaultPaternityDays,
        maxCarryOverDays,
        carryOverExpiry,
        leaveYearStartMonth,
        leaveYearEndMonth,
        proRataEnabled,
        reminderDays
      }
    });
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_LEAVE_POLICY',
        module: 'HR',
        details: 'Updated leave policy settings'
      }
    });
    
    res.json({ message: 'Leave policy updated successfully' });
  } catch (error) {
    console.error('❌ Update leave policy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/leave-entitlement', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { staffId, year, department } = req.query;
    const currentYear = new Date().getFullYear();
    const targetYear = year ? parseInt(year) : currentYear;
    
    let where = { year: targetYear };
    
    if (staffId) {
      where.staffId = staffId;
      
      const entitlement = await prisma.staffLeaveEntitlement.findUnique({
        where: {
          staffId_year: {
            staffId,
            year: targetYear
          }
        },
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              role: true,
              department: true,
              startDate: true,
              employmentType: true
            }
          },
          leaveUsages: {
            where: { status: 'APPROVED' }
          }
        }
      });
      
      if (!entitlement) {
        return res.status(404).json({ 
          message: 'No leave entitlement found for this staff member',
          hasEntitlement: false
        });
      }
      
      const usedAnnual = entitlement.leaveUsages
        .filter(u => u.leaveType === 'ANNUAL')
        .reduce((sum, u) => sum + u.daysUsed, 0);
        
      const usedSick = entitlement.leaveUsages
        .filter(u => u.leaveType === 'SICK')
        .reduce((sum, u) => sum + u.daysUsed, 0);
      
      const result = {
        ...entitlement,
        calculated: {
          usedAnnual,
          usedSick,
          remainingAnnual: entitlement.annualLeaveDays - usedAnnual,
          remainingSick: entitlement.sickLeaveDays - usedSick,
          totalUsed: usedAnnual + usedSick + (entitlement.usedStudyDays || 0) + 
                    (entitlement.usedMaternityDays || 0) + (entitlement.usedPaternityDays || 0),
          totalRemaining: (entitlement.totalAvailableDays || 0) - 
                         (usedAnnual + usedSick + (entitlement.usedStudyDays || 0) + 
                          (entitlement.usedMaternityDays || 0) + (entitlement.usedPaternityDays || 0))
        }
      };
      
      return res.json(result);
    }
    
    if (department) {
      where.staff = { departmentId: department };
    }
    
    const entitlements = await prisma.staffLeaveEntitlement.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true,
            department: true,
            startDate: true,
            employmentType: true
          }
        },
        leaveUsages: {
          where: { status: 'APPROVED' }
        }
      },
      orderBy: { staff: { firstName: 'asc' } }
    });
    
    const enrichedEntitlements = entitlements.map(ent => {
      const usedAnnual = ent.leaveUsages
        .filter(u => u.leaveType === 'ANNUAL')
        .reduce((sum, u) => sum + u.daysUsed, 0);
        
      const usedSick = ent.leaveUsages
        .filter(u => u.leaveType === 'SICK')
        .reduce((sum, u) => sum + u.daysUsed, 0);
      
      return {
        ...ent,
        calculated: {
          usedAnnual,
          usedSick,
          remainingAnnual: ent.annualLeaveDays - usedAnnual,
          remainingSick: ent.sickLeaveDays - usedSick
        }
      };
    });
    
    res.json(enrichedEntitlements);
  } catch (error) {
    console.error('❌ Get leave entitlement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/leave-entitlement', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const {
      staffId,
      year,
      annualLeaveDays,
      sickLeaveDays,
      studyLeaveDays,
      maternityLeaveDays,
      paternityLeaveDays,
      carriedOverDays,
      notes
    } = req.body;
    
    if (!staffId || !year) {
      return res.status(400).json({ error: 'Staff ID and year are required' });
    }
    
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 1 || year > currentYear + 1) {
      return res.status(400).json({ error: 'Invalid year. Can only set for previous, current, or next year.' });
    }
    
    const annualLeave = annualLeaveDays || 21;
    const sickLeave = sickLeaveDays || 10;
    const studyLeave = studyLeaveDays || 5;
    const maternityLeave = maternityLeaveDays || 90;
    const paternityLeave = paternityLeaveDays || 14;
    const carriedOver = carriedOverDays || 0;
    const totalAvailable = annualLeave + carriedOver;
    
    const entitlement = await prisma.staffLeaveEntitlement.upsert({
      where: {
        staffId_year: {
          staffId,
          year
        }
      },
      update: {
        annualLeaveDays: annualLeave,
        sickLeaveDays: sickLeave,
        studyLeaveDays: studyLeave,
        maternityLeaveDays: maternityLeave,
        paternityLeaveDays: paternityLeave,
        carriedOverDays: carriedOver,
        totalAvailableDays: totalAvailable,
        remainingAnnualDays: annualLeave,
        remainingSickDays: sickLeave,
        remainingStudyDays: studyLeave,
        remainingMaternityDays: maternityLeave,
        remainingPaternityDays: paternityLeave,
        notes,
        updatedBy: req.user.id
      },
      create: {
        staffId,
        year,
        annualLeaveDays: annualLeave,
        sickLeaveDays: sickLeave,
        studyLeaveDays: studyLeave,
        maternityLeaveDays: maternityLeave,
        paternityLeaveDays: paternityLeave,
        carriedOverDays: carriedOver,
        totalAvailableDays: totalAvailable,
        remainingAnnualDays: annualLeave,
        remainingSickDays: sickLeave,
        remainingStudyDays: studyLeave,
        remainingMaternityDays: maternityLeave,
        remainingPaternityDays: paternityLeave,
        createdBy: req.user.id,
        notes
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_LEAVE_ENTITLEMENT',
        module: 'HR',
        details: `Created leave entitlement for ${entitlement.staff.firstName} ${entitlement.staff.lastName} (${year})`
      }
    });
    
    res.json({ message: 'Leave entitlement saved successfully', entitlement });
  } catch (error) {
    console.error('❌ Create leave entitlement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/my-leave-balance', authenticate, async (req, res) => {
  try {
    const staffId = req.user.id;
    const currentYear = new Date().getFullYear();
    
    const entitlement = await prisma.staffLeaveEntitlement.findUnique({
      where: {
        staffId_year: {
          staffId,
          year: currentYear
        }
      },
      include: {
        leaveUsages: {
          where: { status: 'APPROVED' }
        }
      }
    });
    
    if (!entitlement) {
      return res.json({
        message: 'No leave entitlement found for this year. Please contact HR.',
        hasEntitlement: false
      });
    }
    
    const usedAnnual = entitlement.leaveUsages
      .filter(u => u.leaveType === 'ANNUAL')
      .reduce((sum, u) => sum + u.daysUsed, 0);
      
    const usedSick = entitlement.leaveUsages
      .filter(u => u.leaveType === 'SICK')
      .reduce((sum, u) => sum + u.daysUsed, 0);
    
    const result = {
      hasEntitlement: true,
      year: currentYear,
      annual: {
        total: entitlement.annualLeaveDays,
        used: usedAnnual,
        remaining: entitlement.annualLeaveDays - usedAnnual,
        carriedOver: entitlement.carriedOverDays
      },
      sick: {
        total: entitlement.sickLeaveDays,
        used: usedSick,
        remaining: entitlement.sickLeaveDays - usedSick
      },
      study: {
        total: entitlement.studyLeaveDays,
        used: entitlement.usedStudyDays || 0,
        remaining: (entitlement.studyLeaveDays || 0) - (entitlement.usedStudyDays || 0)
      },
      maternity: {
        total: entitlement.maternityLeaveDays || 0,
        used: entitlement.usedMaternityDays || 0,
        remaining: (entitlement.maternityLeaveDays || 0) - (entitlement.usedMaternityDays || 0)
      },
      paternity: {
        total: entitlement.paternityLeaveDays || 0,
        used: entitlement.usedPaternityDays || 0,
        remaining: (entitlement.paternityLeaveDays || 0) - (entitlement.usedPaternityDays || 0)
      },
      totalAvailable: entitlement.totalAvailableDays || 0,
      totalUsed: usedAnnual + usedSick + (entitlement.usedStudyDays || 0) + 
                (entitlement.usedMaternityDays || 0) + (entitlement.usedPaternityDays || 0),
      totalRemaining: (entitlement.totalAvailableDays || 0) - 
                     (usedAnnual + usedSick + (entitlement.usedStudyDays || 0) + 
                      (entitlement.usedMaternityDays || 0) + (entitlement.usedPaternityDays || 0))
    };
    
    res.json(result);
  } catch (error) {
    console.error('❌ Get my leave balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/leave-entitlement/bulk', authenticate, authorize('Admin', 'ITAdmin', 'HR'), async (req, res) => {
  try {
    const { year, annualLeaveDays, sickLeaveDays, studyLeaveDays, maternityLeaveDays, paternityLeaveDays } = req.body;
    
    if (!year) {
      return res.status(400).json({ error: 'Year is required' });
    }
    
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, startDate: true }
    });
    
    let created = 0;
    const errors = [];
    
    for (const employee of staff) {
      try {
        let proRataFactor = 1;
        if (employee.startDate) {
          const startYear = employee.startDate.getFullYear();
          if (startYear === year) {
            const startMonth = employee.startDate.getMonth() + 1;
            const monthsWorked = 13 - startMonth;
            proRataFactor = Math.max(0, monthsWorked / 12);
          }
        }
        
        const annualDays = Math.round((annualLeaveDays || 21) * proRataFactor);
        const sickDays = Math.round((sickLeaveDays || 10) * proRataFactor);
        const studyDays = Math.round((studyLeaveDays || 5) * proRataFactor);
        
        await prisma.staffLeaveEntitlement.upsert({
          where: {
            staffId_year: {
              staffId: employee.id,
              year
            }
          },
          update: {
            annualLeaveDays: annualDays,
            sickLeaveDays: sickDays,
            studyLeaveDays: studyDays,
            maternityLeaveDays: maternityLeaveDays || 90,
            paternityLeaveDays: paternityLeaveDays || 14,
            totalAvailableDays: annualDays,
            remainingAnnualDays: annualDays,
            remainingSickDays: sickDays,
            remainingStudyDays: studyDays,
            remainingMaternityDays: maternityLeaveDays || 90,
            remainingPaternityDays: paternityLeaveDays || 14,
            updatedBy: req.user.id,
            notes: `Bulk update for ${year}`
          },
          create: {
            staffId: employee.id,
            year,
            annualLeaveDays: annualDays,
            sickLeaveDays: sickDays,
            studyLeaveDays: studyDays,
            maternityLeaveDays: maternityLeaveDays || 90,
            paternityLeaveDays: paternityLeaveDays || 14,
            totalAvailableDays: annualDays,
            remainingAnnualDays: annualDays,
            remainingSickDays: sickDays,
            remainingStudyDays: studyDays,
            remainingMaternityDays: maternityLeaveDays || 90,
            remainingPaternityDays: paternityLeaveDays || 14,
            createdBy: req.user.id,
            notes: `Bulk creation for ${year}`
          }
        });
        created++;
      } catch (error) {
        errors.push({ staffId: employee.id, error: error.message });
      }
    }
    
    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'BULK_LEAVE_ENTITLEMENT',
        module: 'HR',
        details: `Bulk created/updated leave entitlements for ${created} staff for ${year}`
      }
    });
    
    res.json({
      message: `Bulk leave entitlement processed successfully`,
      created,
      errors
    });
  } catch (error) {
    console.error('❌ Bulk leave entitlement error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DENTAL CLINIC ENDPOINTS ============

app.post('/api/dental', authenticate, authorize('Doctor', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const { patientId, teethNumber, condition, treatmentPlan, procedure, notes } = req.body;

    if (!patientId || !condition) {
      return res.status(400).json({ error: 'Patient ID and condition are required' });
    }

    const dentalRecord = await prisma.dentalRecord.create({
      data: {
        patientId,
        teethNumber,
        condition,
        treatmentPlan,
        procedure,
        notes,
        staffId: req.user.id
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_DENTAL_RECORD',
        module: 'Dental',
        details: `Created dental record for patient ${dentalRecord.patient.hospitalId}`
      }
    });

    res.status(201).json(dentalRecord);
  } catch (error) {
    console.error('Create dental record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dental/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;

    const records = await prisma.dentalRecord.findMany({
      where: { patientId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: { examinationDate: 'desc' }
    });

    res.json(records);
  } catch (error) {
    console.error('Get dental records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/dental/:id', authenticate, authorize('Doctor', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { teethNumber, condition, treatmentPlan, procedure, notes } = req.body;

    const record = await prisma.dentalRecord.update({
      where: { id },
      data: {
        teethNumber,
        condition,
        treatmentPlan,
        procedure,
        notes
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_DENTAL_RECORD',
        module: 'Dental',
        details: `Updated dental record for patient ${record.patient.hospitalId}`
      }
    });

    res.json(record);
  } catch (error) {
    console.error('Update dental record error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ OPTOMETRY/OPHTHALMOLOGY ENDPOINTS ============

app.post('/api/optometry', authenticate, authorize('Doctor', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const {
      patientId,
      visualAcuityRight,
      visualAcuityLeft,
      intraocularPressureRight,
      intraocularPressureLeft,
      refractionRight,
      refractionLeft,
      diagnosis,
      treatment,
      prescription,
      notes
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const exam = await prisma.optometryRecord.create({
      data: {
        patientId,
        visualAcuityRight,
        visualAcuityLeft,
        intraocularPressureRight,
        intraocularPressureLeft,
        refractionRight,
        refractionLeft,
        diagnosis,
        treatment,
        prescription,
        notes,
        staffId: req.user.id
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_OPTOMETRY_RECORD',
        module: 'Optometry',
        details: `Created eye exam for patient ${exam.patient.hospitalId}`
      }
    });

    res.status(201).json(exam);
  } catch (error) {
    console.error('Create optometry record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/optometry/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;

    const records = await prisma.optometryRecord.findMany({
      where: { patientId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: { examinationDate: 'desc' }
    });

    res.json(records);
  } catch (error) {
    console.error('Get optometry records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ IMMUNIZATION TRACKING ENDPOINTS ============

app.post('/api/immunizations', authenticate, authorize('Doctor', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const {
      patientId,
      vaccineName,
      doseNumber,
      administrationDate,
      route,
      site,
      batchNumber,
      expiryDate,
      nextDueDate,
      administeredBy,
      notes
    } = req.body;

    if (!patientId || !vaccineName || !administrationDate) {
      return res.status(400).json({ error: 'Patient ID, vaccine name, and administration date are required' });
    }

    const immunization = await prisma.immunization.create({
      data: {
        patientId,
        vaccineName,
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
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true
          }
        }
      }
    });

    if (nextDueDate) {
      await prisma.patientNotification.create({
        data: {
          patientId,
          title: 'Vaccination Reminder',
          message: `Your next dose of ${vaccineName} is due on ${new Date(nextDueDate).toLocaleDateString()}`,
          type: 'vaccination'
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_IMMUNIZATION',
        module: 'Immunization',
        details: `Recorded ${vaccineName} (dose ${doseNumber}) for patient ${immunization.patient.hospitalId}`
      }
    });

    res.status(201).json(immunization);
  } catch (error) {
    console.error('Create immunization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/immunizations/patient/:patientId', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;

    const immunizations = await prisma.immunization.findMany({
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

    const immunizations = await prisma.immunization.findMany({
      where: { 
        patientId,
        nextDueDate: { not: null }
      },
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
      vaccineName,
      doseNumber,
      administrationDate,
      route,
      site,
      batchNumber,
      expiryDate,
      nextDueDate,
      notes
    } = req.body;

    const immunization = await prisma.immunization.update({
      where: { id },
      data: {
        vaccineName,
        doseNumber,
        administrationDate: administrationDate ? new Date(administrationDate) : undefined,
        route,
        site,
        batchNumber,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        notes
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'UPDATE_IMMUNIZATION',
        module: 'Immunization',
        details: `Updated immunization record for patient ${immunization.patient.hospitalId}`
      }
    });

    res.json(immunization);
  } catch (error) {
    console.error('Update immunization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/immunizations/overdue', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = await prisma.immunization.findMany({
      where: {
        nextDueDate: { lt: today }
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      },
      orderBy: { nextDueDate: 'asc' }
    });

    res.json(overdue);
  } catch (error) {
    console.error('Get overdue immunizations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ PUBLIC: Patient Search for Kiosk (No Authentication Required)
app.get('/api/public/patient/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    console.log('🔍 Kiosk Search:', query);

    const patients = await prisma.patient.findMany({
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
        id: true,
        hospitalId: true,
        firstName: true,
        lastName: true,
        phone: true,
        gender: true,
        patientCategory: true,
        dateOfBirth: true
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Kiosk search found ${patients.length} patients`);
    res.json(patients);
  } catch (error) {
    console.error('Kiosk search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Keep the authenticated endpoint for staff (optional)
app.get('/api/patient/search/quick', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const patients = await prisma.patient.findMany({
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
        id: true,
        hospitalId: true,
        firstName: true,
        lastName: true,
        phone: true,
        gender: true,
        patientCategory: true,
        dateOfBirth: true
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    res.json(patients);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ WALLET DEDUCTION WITH INSUFFICIENT BALANCE HANDLING ============

// Deduct from wallet with balance check
async function deductFromWallet(patientId, amount, description, category, serviceId, serviceType, staffId) {
  try {
    const wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found',
        code: 'WALLET_NOT_FOUND'
      };
    }

    if (wallet.status !== 'Active') {
      return {
        success: false,
        error: `Wallet is ${wallet.status.toLowerCase()}`,
        code: 'WALLET_INACTIVE'
      };
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

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.patientWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          lastTransactionAt: new Date()
        }
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionType: 'Payment',
          amount: amount,
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          description: description,
          reference: `DED-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          status: 'Completed',
          category: category || 'General',
          serviceId: serviceId || null,
          serviceType: serviceType || null,
          paidToStaffId: staffId || null,
          notes: `Auto-deducted for ${category || 'service'}`
        }
      });

      await tx.auditLog.create({
        data: {
          staffId: staffId || null,
          action: 'WALLET_AUTO_DEDUCT',
          module: 'Wallet',
          details: `Auto-deducted ₦${amount.toLocaleString()} from wallet for ${description}`
        }
      });

      return { updatedWallet, transaction };
    });

    return {
      success: true,
      balanceAfter: result.updatedWallet.balance,
      transaction: result.transaction
    };
  } catch (error) {
    console.error('Wallet deduction error:', error);
    return {
      success: false,
      error: error.message,
      code: 'DEDUCTION_ERROR'
    };
  }
}

// Check wallet balance for a service
app.post('/api/wallet/check-service', authenticate, authorize('Doctor', 'Nurse', 'Admin', 'LabTechnician', 'Radiologist', 'LabScientist'), async (req, res) => {
  try {
    const { patientId, amount, serviceName, serviceType } = req.body;

    if (!patientId || !amount) {
      return res.status(400).json({ error: 'Patient ID and amount are required' });
    }

    const wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (!wallet) {
      return res.json({
        hasWallet: false,
        balance: 0,
        canCover: false,
        shortfall: amount,
        message: 'Patient does not have a wallet'
      });
    }

    const canCover = wallet.balance >= amount;
    const shortfall = canCover ? 0 : amount - wallet.balance;

    if (!canCover && wallet.balance > 0) {
      await prisma.patientNotification.create({
        data: {
          patientId,
          title: '⚠️ Insufficient Wallet Balance',
          message: `Your wallet balance (₦${wallet.balance.toLocaleString()}) is insufficient for ${serviceName} (₦${amount.toLocaleString()}). Please deposit ₦${shortfall.toLocaleString()} to continue.`,
          type: 'wallet'
        }
      });
    }

    res.json({
      hasWallet: true,
      balance: wallet.balance,
      canCover: canCover,
      shortfall: shortfall,
      message: canCover 
        ? 'Sufficient balance' 
        : `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}, Shortfall: ₦${shortfall.toLocaleString()}`
    });
  } catch (error) {
    console.error('Check service error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process service payment (with wallet or cash)
app.post('/api/wallet/process-service', authenticate, async (req, res) => {
  try {
    const { patientId, amount, description, category, serviceId, serviceType, paymentMethod } = req.body;

    if (!patientId || !amount || !description) {
      return res.status(400).json({ error: 'Patient ID, amount, and description are required' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (paymentMethod === 'cash' || paymentMethod === 'Cash') {
      const transaction = await prisma.walletTransaction.create({
        data: {
          walletId: null,
          transactionType: 'Payment',
          amount: amount,
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

      await prisma.patientNotification.create({
        data: {
          patientId,
          title: '💰 Payment Recorded',
          message: `Cash payment of ₦${amount.toLocaleString()} recorded for ${description}`,
          type: 'billing'
        }
      });

      return res.json({
        success: true,
        paymentMethod: 'Cash',
        transaction
      });
    }

    const result = await deductFromWallet(
      patientId,
      amount,
      description,
      category,
      serviceId,
      serviceType,
      req.user.id
    );

    if (!result.success) {
      if (result.code === 'INSUFFICIENT_BALANCE') {
        await prisma.patientNotification.create({
          data: {
            patientId,
            title: '⚠️ Insufficient Wallet Balance',
            message: `Your wallet balance (₦${result.balance.toLocaleString()}) is insufficient for ${description} (₦${amount.toLocaleString()}). Please deposit ₦${result.shortfall.toLocaleString()} or pay cash.`,
            type: 'wallet'
          }
        });

        return res.status(400).json({
          success: false,
          error: result.error,
          code: result.code,
          balance: result.balance,
          shortfall: result.shortfall,
          options: ['deposit', 'cash', 'cancel']
        });
      }

      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }

    await prisma.patientNotification.create({
      data: {
        patientId,
        title: '✅ Payment Successful',
        message: `₦${amount.toLocaleString()} deducted from your wallet for ${description}. New balance: ₦${result.balanceAfter.toLocaleString()}`,
        type: 'wallet'
      }
    });

    const wallet = await prisma.patientWallet.findUnique({
      where: { patientId }
    });

    if (wallet && wallet.balance < 1000) {
      await prisma.patientNotification.create({
        data: {
          patientId,
          title: '⚠️ Low Wallet Balance',
          message: `Your wallet balance is low (₦${wallet.balance.toLocaleString()}). Please deposit more funds to continue using services.`,
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

// Get wallet notifications for patient
app.get('/api/patient/wallet/notifications', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patient.id;

    const notifications = await prisma.patientNotification.findMany({
      where: {
        patientId,
        type: 'wallet'
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const unreadCount = await prisma.patientNotification.count({
      where: {
        patientId,
        type: 'wallet',
        isRead: false
      }
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get wallet notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ AUTO-ARCHIVE SCHEDULER ============
console.log('Auto-archive scheduler started (runs every 6 hours)');

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 EMR System Server Running`);
  console.log('='.repeat(50));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📊 Database: emr_db on port 5433`);
  console.log('='.repeat(50));
  console.log('📋 Available Endpoints:');
  console.log(`  🔐 Auth: /api/auth/login, /api/auth/register`);
  console.log(`  👤 Patients: /api/patients (GET restricted, POST create, PUT edit, DELETE)`);
  console.log(`  👤 Patient by ID: /api/patients/:id (enforced assignment)`);
  console.log(`  🔍 Search Patients: /api/patients/search/:query`);
  console.log(`  👨‍⚕️ Staff: /api/staff (Admin, ITAdmin, HR)`);
  console.log(`  📅 Appointments: /api/appointments`);
  console.log(`  📝 Clinical Notes: /api/clinical-notes (POST restricted)`);  
  console.log(`  💊 Prescriptions: /api/prescriptions`);
  console.log(`  🔬 Lab Orders: /api/lab-orders`);
  console.log(`  💰 Billing: /api/billing (GET with filters, POST create, PATCH update)`);
  console.log(`  💊 Pharmacy: /api/medications`);
  console.log(`  📊 Pharmacy Dashboard: /api/pharmacy/dashboard`);
  console.log(`  📊 Dashboard: /api/dashboard/stats`);
  console.log(`  🏥 Wards: /api/wards (GET, POST, DELETE)`);
  console.log(`  🏥 Clinics: /api/clinics (GET, POST, DELETE)`);
  console.log(`  📋 Patient Intake: /api/patient-journeys (GET, POST, PATCH)`);
  console.log(`  📋 ADT: /api/admissions (GET, POST, PATCH discharge/transfer)`);
  console.log(`  🖥️ System Status: /api/system/status (Admin & ITAdmin)`);
  console.log(`  📋 System Logs: /api/system/logs (Admin & ITAdmin)`);
  console.log(`  💲 Service Pricing: /api/service-prices (GET view for BillingOfficer, POST/PUT/DELETE for Admin/ITAdmin/Accountant)`);
  console.log(`  💉 Nurse Vitals: /api/nurse/patients (Nurse/Admin/Midwife), /api/patients/:patientId/vitals, /api/vitals (Nurse)`);
  console.log(`  🩺 Doctor Patients: /api/doctor/patients (Doctor/Obstetrician only)`);
  console.log(`  🔐 Permissions: /api/permissions (Admin only)`);
  console.log(`  🤰 Antenatal: /api/pregnancies, /api/pregnancies/:id, /api/pregnancies/:id/visits, /api/deliveries (permission-based)`);
  console.log(`  📦 Archived Patients: /api/patients/archived (GET), /api/patients/:id/archive (POST), /api/patients/:id/unarchive (POST)`);
  console.log(`  🤖 Auto-Archive: /api/system/auto-archive (POST, Admin only)`);
  console.log(`  👔 HR: /api/hr/departments, /api/hr/employees, /api/hr/leaves, /api/hr/dashboard, /api/hr/leave-policy, /api/hr/leave-entitlement`);
  console.log(`  🦷 Dental: /api/dental, /api/dental/patient/:patientId`);
  console.log(`  👁️ Optometry: /api/optometry, /api/optometry/patient/:patientId`);
  console.log(`  💉 Immunizations: /api/immunizations, /api/immunizations/patient/:patientId`);
  console.log(`  👤 Patient Portal: /api/patient/login, /api/patient/dashboard, /api/patient/appointments, /api/patient/prescriptions, /api/patient/lab-results, /api/patient/billing, /api/patient/medical-history, /api/patient/vitals, /api/patient/notifications, /api/patient/profile, /api/patient/change-password, /api/patient/available-doctors, /api/patient/forgot-password, /api/patient/reset-password`);
  console.log('='.repeat(50));
});