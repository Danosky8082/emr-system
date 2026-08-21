// server.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
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

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000
});
app.use('/api', limiter);

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
        console.log(`⚠️ No permission record found for role: ${userRole}, creating default...`);
        await prisma.rolePermission.create({
          data: { 
            role: userRole,
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
            archivedPatients: false
          }
        });
        return res.status(403).json({ error: 'Forbidden – insufficient permissions' });
      }

      if (!rolePerm[permissionKey]) {
        console.log(`⚠️ Permission denied: ${userRole} does not have ${permissionKey}`);
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

// ============ PATIENT ARCHIVE ENDPOINTS ============
app.get('/api/patients/archived', authenticate, checkPermission('archivedPatients'), async (req, res) => {
  try {
    console.log('📦 Fetching archived patients...');
    console.log('👤 User role:', req.user?.role);
    
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

    console.log(`✅ Found ${patients.length} archived patients`);
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

    console.log(`📦 Archiving patient: ${id}`);

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

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (patient.isArchived) {
      return res.status(400).json({ error: 'Patient is already archived' });
    }

    const hasCompletedJourney = patient.journeys.some(j => j.status === 'COMPLETED');
    if (!hasCompletedJourney) {
      return res.status(400).json({ 
        error: 'Patient must have a completed journey before archiving' 
      });
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

    console.log(`✅ Patient archived: ${patient.hospitalId}`);
    res.json({ 
      message: 'Patient archived successfully', 
      patient: archivedPatient 
    });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/patients/:id/unarchive', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📂 Unarchiving patient: ${id}`);

    const patient = await prisma.patient.findUnique({
      where: { id }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (!patient.isArchived) {
      return res.status(400).json({ error: 'Patient is not archived' });
    }

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

    console.log(`✅ Patient unarchived: ${patient.hospitalId}`);
    res.json({ 
      message: 'Patient unarchived successfully', 
      patient: unarchivedPatient 
    });
  } catch (error) {
    console.error('Unarchive error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ PATIENT ENDPOINTS ============

app.post('/api/patients', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
     const { 
      firstName, lastName, dateOfBirth, gender, phone, email, address, 
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
      patientCategory,
      insuranceProvider,
      insuranceId,
      corporateCompany
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !gender) {
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, dateOfBirth, gender' });
    }
    if (!nextOfKinPhone) {
      return res.status(400).json({ error: 'Next of Kin phone number is required' });
    }

    const allPatients = await prisma.patient.findMany({
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

    let patient;
    let attempts = 0;

    while (attempts < 5) {
      try {
        const hospitalId = ((nextIdNumber * 9301 + 12345) % 1000000)
                          .toString()
                          .padStart(6, '0');

        patient = await prisma.patient.create({
      data: {
        hospitalId, 
        firstName, 
        lastName, 
        dateOfBirth: new Date(dateOfBirth), 
        gender,
        phone, 
        email, 
        address, 
        emergencyContact, 
        allergies,
        nextOfKinName, 
        nextOfKinPhone, 
        nextOfKinRelationship,
        patientCategory: patientCategory || 'FPP',
        insuranceProvider: insuranceProvider || null,
        insuranceId: insuranceId || null,
        corporateCompany: corporateCompany || null
      }
    });
        
        break;
      } catch (err) {
        if (err.code === 'P2002') {
          attempts++;
          nextIdNumber++;
          console.log(`Retry ${attempts}: Checking ID ${((nextIdNumber * 9301 + 12345) % 1000000).toString().padStart(6, '0')}`);
        } else {
          throw err;
        }
      }
    }

    if (!patient) {
      throw new Error('Failed to generate a unique Hospital ID after multiple attempts.');
    }

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

app.get('/api/patients', authenticate, authorize('Admin', 'Records', 'ITAdmin', 'BillingOfficer', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife'), async (req, res) => {
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
        appointments: true,
        clinicalNotes: true,
        prescriptions: true,
        labOrders: true,
        billingRecords: true
      }
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (['Nurse', 'Doctor'].includes(req.user.role)) {
      const activeJourney = await prisma.patientJourney.findFirst({
        where: {
          patientId: patientId,
          status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] }
        },
        select: { clinicId: true, wardId: true }
      });

      if (!activeJourney) {
        return res.status(403).json({ 
          error: 'This patient has not yet arrived at a clinic or ward. You cannot view their profile yet.'
        });
      }

      const staff = await prisma.staff.findUnique({
        where: { id: req.user.id },
        include: {
          clinics: { select: { clinicId: true } },
          wards: { select: { wardId: true } }
        }
      });
      const allowedClinicIds = staff.clinics.map(c => c.clinicId);
      const allowedWardIds = staff.wards.map(w => w.wardId);

      const isAuthorized = 
        (activeJourney.clinicId && allowedClinicIds.includes(activeJourney.clinicId)) ||
        (activeJourney.wardId && allowedWardIds.includes(activeJourney.wardId));

      if (!isAuthorized) {
        return res.status(403).json({ 
          error: 'You are not assigned to the clinic or ward where this patient is located.'
        });
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
    const { 
      firstName, lastName, dateOfBirth, gender, phone, email, address, 
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
      patientCategory,
      insuranceProvider,
      insuranceId,
      corporateCompany
    } = req.body;

    console.log('📝 Updating patient:', id);
    console.log('📝 New category:', patientCategory);

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        firstName, 
        lastName, 
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender, 
        phone, 
        email, 
        address, 
        emergencyContact, 
        allergies,
        nextOfKinName, 
        nextOfKinPhone, 
        nextOfKinRelationship,
        patientCategory: patientCategory || 'FPP',
        insuranceProvider: insuranceProvider || null,
        insuranceId: insuranceId || null,
        corporateCompany: corporateCompany || null
      }
    });

    console.log('✅ Patient updated:', patient);
    res.json(patient);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/patients/:id', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id.length < 5) {
      return res.status(400).json({ error: 'Invalid patient ID format.' });
    }

    const existingPatient = await prisma.patient.findUnique({
      where: { id }
    });
    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    await prisma.patient.delete({
      where: { id }
    });

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);

    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Cannot delete this patient because they have associated records (appointments, billing, prescriptions, etc.). Please remove those records first or contact your system administrator.'
      });
    }

    res.status(400).json({ error: error.message || 'Failed to delete patient.' });
  }
});

// ============ STAFF MANAGEMENT ENDPOINTS ============

app.get('/api/staff', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const staffWithoutPasswords = staff.map(({ password, ...rest }) => rest);
    res.json(staffWithoutPasswords);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await prisma.staff.findUnique({
      where: { id }
    });
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    const { password, ...staffWithoutPassword } = staff;
    res.json(staffWithoutPassword);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { employeeId, firstName, lastName, username, email, role, department, password } = req.body;

    if (!employeeId || !firstName || !lastName || !username || !email || !role || !password) {
      return res.status(400).json({
        error: 'Missing required fields: employeeId, firstName, lastName, username, email, role, password'
      });
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
        department,
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
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, firstName, lastName, username, email, role, department, isActive } = req.body;

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
        department,
        isActive
      }
    });

    const { password, ...staffWithoutPassword } = staff;
    res.json(staffWithoutPassword);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingStaff = await prisma.staff.findUnique({
      where: { id }
    });
    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: { isActive: false }
    });

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

app.patch('/api/staff/:id/reactivate', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingStaff = await prisma.staff.findUnique({
      where: { id }
    });
    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: { isActive: true }
    });

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

app.post('/api/staff/:id/reset-password', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingStaff = await prisma.staff.findUnique({
      where: { id }
    });
    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const staff = await prisma.staff.update({
      where: { id },
      data: { password: hashedPassword }
    });

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
      include: {
        patient: true,
        staff: true
      },
      orderBy: { dateTime: 'asc' }
    });
    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/appointments/staff/:staffId', authenticate, async (req, res) => {
  try {
    const { staffId } = req.params;
    const appointments = await prisma.appointment.findMany({
      where: { staffId },
      include: {
        patient: true,
        staff: true
      },
      orderBy: { dateTime: 'asc' }
    });
    res.json(appointments);
  } catch (error) {
    console.error('Get staff appointments error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/appointments', authenticate, async (req, res) => {
  try {
    const { patientId, staffId, dateTime, duration, type, notes } = req.body;

    if (!patientId || !staffId || !dateTime) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, staffId, dateTime'
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        staffId,
        dateTime: new Date(dateTime),
        duration: duration || 30,
        type: type || 'Consultation',
        notes,
        status: 'Scheduled'
      },
      include: {
        patient: true,
        staff: true
      }
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

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        patient: true,
        staff: true
      }
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

app.get('/api/patients/:patientId/notes', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const notes = await prisma.clinicalNote.findMany({
      where: { patientId },
      include: {
        author: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clinical-notes', authenticate, authorize('Doctor', 'Nurse', 'Admin', 'Records'), async (req, res) => {
  try {
    const { patientId, type, subjective, objective, assessment, plan, fullContent } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: 'Missing required field: patientId'
      });
    }

    const note = await prisma.clinicalNote.create({
      data: {
        patientId,
        authorId: req.user.id,
        type: type || 'SOAP',
        subjective,
        objective,
        assessment,
        plan,
        fullContent
      },
      include: {
        patient: true,
        author: true
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_NOTE',
        module: 'Clinical',
        details: `Created ${type} note for patient ${note.patient.hospitalId}`
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

    const existing = await prisma.clinicalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.authorId !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only edit your own notes' });
    }

    const note = await prisma.clinicalNote.update({
      where: { id },
      data: { type, subjective, objective, assessment, plan, fullContent },
    });
    res.json(note);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/clinical-notes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.clinicalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.authorId !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }

    await prisma.clinicalNote.delete({ where: { id } });
    res.json({ message: 'Note deleted successfully' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ============ PRESCRIPTION ENDPOINTS ============

app.get('/api/prescriptions', authenticate, async (req, res) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        },
        prescribedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        dispensedBy: {
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
    res.json(prescriptions);
  } catch (error) {
    console.error('Get all prescriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/:patientId/prescriptions', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId },
      include: {
        prescribedBy: true,
        dispensedBy: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(prescriptions);
  } catch (error) {
    console.error('Get prescriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prescriptions', authenticate, authorize('Doctor', 'Nurse'), async (req, res) => {
  try {
    const { patientId, medication, dosage, frequency, duration, instructions } = req.body;

    if (!patientId || !medication || !dosage || !frequency) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, medication, dosage, frequency'
      });
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
      include: {
        patient: true,
        prescribedBy: true
      }
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
    const { quantity } = req.body;

    const prescription = await prisma.prescription.update({
      where: { id },
      data: {
        dispensingStaffId: req.user.id,
        status: 'Dispensed'
      },
      include: {
        patient: true,
        prescribedBy: true,
        dispensedBy: true
      }
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

app.get('/api/lab-orders', authenticate, async (req, res) => {
  try {
    const labOrders = await prisma.labOrder.findMany({
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
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        performedBy: {
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
    res.json(labOrders);
  } catch (error) {
    console.error('Get all lab orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/:patientId/lab-orders', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const labOrders = await prisma.labOrder.findMany({
      where: { patientId },
      include: {
        orderedBy: true,
        performedBy: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(labOrders);
  } catch (error) {
    console.error('Get lab orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lab-orders', authenticate, authorize('Doctor', 'Nurse'), async (req, res) => {
  try {
    const { patientId, testName, testType, priority, notes } = req.body;

    if (!patientId || !testName || !testType) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, testName, testType'
      });
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
      include: {
        patient: true,
        orderedBy: true
      }
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

app.patch('/api/lab-orders/:id/results', authenticate, authorize('Doctor', 'Nurse'), async (req, res) => {
  try {
    const { id } = req.params;
    const { result, status } = req.body;

    if (!result) {
      return res.status(400).json({ error: 'Result is required' });
    }

    const labOrder = await prisma.labOrder.update({
      where: { id },
      data: {
        result,
        status: status || 'Completed',
        resultDate: new Date(),
        labStaffId: req.user.id
      },
      include: {
        patient: true,
        orderedBy: true,
        performedBy: true
      }
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

// ============ BILLING ENDPOINTS ============

function calculateAmountByCategory(baseAmount, patientCategory) {
  switch (patientCategory) {
    case 'NHIS':
      return Math.round(baseAmount * 0.1);
    case 'CORPORATE':
      return baseAmount * 2;
    case 'FPP':
    default:
      return baseAmount;
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

app.get('/api/patients/:patientId/bills', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;
    const bills = await prisma.billingRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bills);
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/billing', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;

    let where = {};
    if (status && status !== 'All') {
      where.status = status;
    }
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
      where: {
        ...where,
        patient: patientFilter
      },
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
        journey: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.billingRecord.count({
      where: {
        ...where,
        patient: patientFilter
      }
    });

    res.json({
      data: bills,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get billing records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PHARMACY INVENTORY ENDPOINTS ============

app.get('/api/medications', authenticate, async (req, res) => {
  try {
    const medications = await prisma.medication.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(medications);
  } catch (error) {
    console.error('Get medications error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medications/low-stock', authenticate, async (req, res) => {
  try {
    const medications = await prisma.medication.findMany({
      where: {
        stockQuantity: {
          lte: prisma.medication.fields.reorderLevel
        }
      },
      orderBy: { stockQuantity: 'asc' }
    });
    res.json(medications);
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/medications', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { name, genericName, category, supplier, unitPrice, stockQuantity, reorderLevel, expiryDate, batchNumber } = req.body;

    if (!name || !category || !unitPrice || !stockQuantity || !expiryDate) {
      return res.status(400).json({
        error: 'Missing required fields: name, category, unitPrice, stockQuantity, expiryDate'
      });
    }

    const medication = await prisma.medication.create({
      data: {
        name,
        genericName,
        category,
        supplier,
        unitPrice: parseFloat(unitPrice) || 0,
        stockQuantity: parseInt(stockQuantity) || 0,
        reorderLevel: parseInt(reorderLevel) || 10,
        expiryDate: new Date(expiryDate),
        batchNumber
      }
    });

    await prisma.medicationTransaction.create({
      data: {
        medicationId: medication.id,
        transactionType: 'Purchase',
        quantity: parseInt(stockQuantity) || 0,
        unitPrice: parseFloat(unitPrice) || 0,
        note: 'Initial stock',
        staffId: req.user.id
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

    console.log('📝 Updating medication with ID:', id);
    console.log('📝 Update data:', req.body);

    if (!name || !category || !unitPrice || !stockQuantity || !expiryDate) {
      return res.status(400).json({
        error: 'Missing required fields: name, category, unitPrice, stockQuantity, expiryDate'
      });
    }

    const existingMedication = await prisma.medication.findUnique({
      where: { id: id }
    });

    if (!existingMedication) {
      console.log('❌ Medication not found with ID:', id);
      return res.status(404).json({ error: 'Medication not found' });
    }

    const medication = await prisma.medication.update({
      where: { id: id },
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

    console.log('✅ Medication updated successfully:', medication.id);

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
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Medication not found' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/medications/:id', authenticate, authorize('Admin', 'ITAdmin', 'Pharmacist'), async (req, res) => {
  try {
    const { id } = req.params;

    const existingMedication = await prisma.medication.findUnique({
      where: { id }
    });

    if (!existingMedication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    const transactions = await prisma.medicationTransaction.count({
      where: { medicationId: id }
    });

    if (transactions > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete medication with transaction history. Mark as inactive instead.' 
      });
    }

    await prisma.medication.delete({
      where: { id }
    });

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
      return res.status(400).json({
        error: 'Missing required fields: quantity, transactionType'
      });
    }

    const medication = await prisma.medication.findUnique({
      where: { id }
    });

    if (!medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    let newStock = medication.stockQuantity;
    if (transactionType === 'Purchase' || transactionType === 'Returned') {
      newStock += quantity;
    } else if (transactionType === 'Dispensed' || transactionType === 'Adjusted') {
      newStock -= quantity;
    }

    if (newStock < 0) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const updatedMedication = await prisma.medication.update({
      where: { id },
      data: {
        stockQuantity: newStock
      }
    });

    await prisma.medicationTransaction.create({
      data: {
        medicationId: id,
        transactionType,
        quantity,
        unitPrice: medication.unitPrice,
        note: note || `Stock ${transactionType}`,
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

// ============ AUDIT LOG ENDPOINTS ============

app.get('/api/audit-logs', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const logs = await prisma.auditLog.findMany({
      include: {
        staff: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await prisma.auditLog.count();
    res.json({
      data: logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DASHBOARD STATISTICS ============

app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    console.log('🔍 Dashboard stats for role:', role);

    let responseData = {};

    const genderData = await prisma.patient.groupBy({ by: ['gender'], _count: true });
    const monthlyRegistrations = await prisma.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*) as count
      FROM "Patient"
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY month ORDER BY month ASC
    `;

    if (['Admin', 'Records', 'ITAdmin'].includes(role)) {
      const [totalPatients, totalStaff, totalAppointments, pendingBills, totalRevenue, lowStockCount, wardOccupancy] = await Promise.all([
        prisma.patient.count(),
        prisma.staff.count(),
        prisma.appointment.count({ where: { status: 'Scheduled' } }),
        prisma.billingRecord.count({ where: { status: 'Pending' } }),
        prisma.billingRecord.aggregate({ _sum: { totalAmount: true }, where: { status: 'Paid' } }),
        prisma.medication.count({ where: { stockQuantity: { lte: prisma.medication.fields.reorderLevel } } }),
        prisma.admission.groupBy({ by: ['wardId'], _count: { _all: true }, where: { status: 'Admitted' } })
      ]);
      responseData = {
        totalPatients,
        totalStaff,
        totalAppointments,
        pendingBills,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        lowStockCount,
        wardOccupancy
      };
    } else if (['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(role)) {
      const staff = await prisma.staff.findUnique({
        where: { id: req.user.id },
        include: { 
          clinics: { select: { clinicId: true } }, 
          wards: { select: { wardId: true } } 
        }
      });
      const clinicIds = staff.clinics.map(c => c.clinicId);
      const wardIds = staff.wards.map(w => w.wardId);

      const patientJourneys = await prisma.patientJourney.findMany({
        where: {
          status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
          OR: [
            { clinicId: { in: clinicIds } },
            { wardId: { in: wardIds } }
          ]
        },
        select: { patientId: true }
      });
      const patientIds = patientJourneys.map(j => j.patientId);

      const [myPatientsCount, myAppointmentsCount] = await Promise.all([
        prisma.patientJourney.count({
          where: {
            status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
            OR: [
              { clinicId: { in: clinicIds } },
              { wardId: { in: wardIds } }
            ]
          }
        }),
        prisma.appointment.count({ 
          where: { staffId: req.user.id, status: 'Scheduled' } 
        })
      ]);

      let prescriptionsCount = 0;
      let vitalsCount = 0;
      
      if (['Doctor', 'Obstetrician'].includes(role)) {
        if (patientIds.length > 0) {
          prescriptionsCount = await prisma.prescription.count({
            where: { 
              patientId: { in: patientIds },
              prescribingStaffId: req.user.id
            }
          });
        }
        console.log(`💊 Found ${prescriptionsCount} prescriptions written by doctor`);
        responseData = { 
          myPatientsCount, 
          myAppointmentsCount, 
          myPrescriptionsCount: prescriptionsCount
        };
      } else {
        vitalsCount = await prisma.vitalSign.count({ 
          where: { nurseId: req.user.id } 
        });
        console.log(`❤️ Found ${vitalsCount} vitals recorded by nurse`);
        responseData = { 
          myPatientsCount, 
          myAppointmentsCount, 
          myVitalsCount: vitalsCount 
        };
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
      const [pendingBills, totalRevenue, paidBillsCount, revenueTrend] = await Promise.all([
        prisma.billingRecord.count({ where: { status: 'Pending' } }),
        prisma.billingRecord.aggregate({ _sum: { totalAmount: true }, where: { status: 'Paid' } }),
        prisma.billingRecord.count({ where: { status: 'Paid' } }),
        prisma.$queryRaw`
          SELECT TO_CHAR("paymentDate", 'YYYY-MM') as month, SUM("totalAmount") as revenue
          FROM "BillingRecord"
          WHERE "status" = 'Paid' AND "paymentDate" >= NOW() - INTERVAL '6 months'
          GROUP BY month ORDER BY month ASC
        `
      ]);
      responseData = {
        pendingBills,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        paidBillsCount,
        revenueTrend: revenueTrend.map(item => ({ month: item.month, revenue: Number(item.revenue) }))
      };
    } else if (role === 'LabTechnician') {
      const [pendingLabOrders, completedLabOrders] = await Promise.all([
        prisma.labOrder.count({ where: { status: 'Ordered' } }),
        prisma.labOrder.count({ where: { status: 'Completed' } })
      ]);
      responseData = { pendingLabOrders, completedLabOrders };
    } else {
      responseData = { message: 'Stats for this role are work in progress' };
    }

    responseData.genderData = genderData;
    responseData.monthlyRegistrations = monthlyRegistrations.map(item => ({
      month: item.month,
      count: Number(item.count)
    }));

    res.json(responseData);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ SYSTEM STATUS ENDPOINTS ============

app.get('/api/system/status', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const dbStatus = await prisma.$queryRaw`SELECT version()`;
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
      include: {
        staff: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    const total = await prisma.auditLog.count();
    res.json({
      data: logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/user-activity', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const activity = await prisma.auditLog.groupBy({
      by: ['staffId', 'action'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: {
        action: true
      }
    });

    const staffDetails = await prisma.staff.findMany({
      where: {
        id: { in: [...new Set(activity.map(a => a.staffId))] }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });

    const enrichedActivity = activity.map(item => {
      const staff = staffDetails.find(s => s.id === item.staffId);
      return {
        ...item,
        staff: staff || null
      };
    });

    res.json({
      period: `${days} days`,
      totalActions: activity.reduce((sum, a) => sum + a._count.action, 0),
      activity: enrichedActivity
    });
  } catch (error) {
    console.error('User activity error:', error);
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
      data: {
        name: name.trim(),
        description: description || null,
        capacity: capacity ? parseInt(capacity) : null
      }
    });
    res.status(201).json(ward);
  } catch (error) {
    console.error('Create ward error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/wards/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    await prisma.ward.delete({ where: { id: req.params.id } });
    res.json({ message: 'Ward deleted' });
  } catch (error) {
    res.status(400).json({ error: 'Cannot delete ward, it may have active admissions' });
  }
});

// ============ CLINIC MANAGEMENT ============

app.get('/api/clinics', authenticate, async (req, res) => {
  try {
    const clinics = await prisma.clinic.findMany({ orderBy: { name: 'asc' } });
    res.json(clinics);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/clinics', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { name, description, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Clinic name is required' });
    const clinic = await prisma.clinic.create({ data: { name, description, location } });
    res.status(201).json(clinic);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/clinics/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const activeJourneys = await prisma.patientJourney.count({ 
      where: { clinicId: id, status: { notIn: ['COMPLETED'] } } 
    });
    if (activeJourneys > 0) {
      return res.status(400).json({ error: 'Cannot delete clinic, there are active patients referred here.' });
    }
    await prisma.clinic.delete({ where: { id } });
    res.json({ message: 'Clinic deleted successfully' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ============ PATIENT INTAKE & JOURNEY ============

app.get('/api/patient-journeys', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const journeys = await prisma.patientJourney.findMany({
      include: {
        patient: { 
          select: { 
            id: true,
            hospitalId: true, 
            firstName: true, 
            lastName: true, 
            gender: true, 
            dateOfBirth: true,
            isArchived: true,
            patientCategory: true,
            insuranceProvider: true,
            insuranceId: true,
            corporateCompany: true
          } 
        },
        clinic: true,
        ward: true,
        registeredBy: { 
          select: { 
            id: true,
            firstName: true, 
            lastName: true 
          } 
        },
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

    console.log(`🔍 Looking for patient with hospitalId: ${hospitalIdInput}`);

    const patient = await prisma.patient.findUnique({
      where: { hospitalId: hospitalIdInput }
    });

    console.log(`📋 Found patient:`, patient ? `ID: ${patient.id}` : '❌ Not found');

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found. Please check the Hospital ID.' });
    }

    if (destinationType === 'CLINIC' && !clinicId) {
      return res.status(400).json({ error: 'A Clinic must be selected for outpatient visits' });
    }
    if (destinationType === 'WARD' && !wardId) {
      return res.status(400).json({ error: 'A Ward must be selected for inpatient admissions' });
    }

    const existing = await prisma.patientJourney.findFirst({
      where: { patientId: patient.id, status: { not: 'COMPLETED' } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Patient already has an active intake process.' });
    }

    console.log(`🚀 Creating journey for patient ID: ${patient.id}`);

    const journey = await prisma.patientJourney.create({
      data: {
        patientId: patient.id,
        destinationType,
        clinicId: destinationType === 'CLINIC' ? clinicId : null,
        wardId: destinationType === 'WARD' ? wardId : null,
        registeredById: req.user.id,
        status: 'REGISTERED'
      },
      include: { patient: true, clinic: true, ward: true }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'START_INTAKE',
        module: 'Records',
        details: `Started intake for ${journey.patient.hospitalId} to ${destinationType === 'CLINIC' ? journey.clinic.name : journey.ward.name}`
      }
    });

    res.status(201).json(journey);
  } catch (error) {
    console.error('❌ Error in create journey:', error);
    res.status(400).json({ error: error.message });
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
      data: {
        admissionNumber,
        patientId,
        staffId,
        wardId,
        notes,
        status: 'Admitted'
      },
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
      data: {
        status: 'Discharged',
        dischargeDate: new Date(),
        notes: notes || undefined
      },
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
      data: {
        wardId,
        notes: notes || undefined
      },
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
      include: {
        clinics: { select: { clinicId: true } },
        wards: { select: { wardId: true } }
      }
    });
    const clinicIds = staff.clinics.map(c => c.clinicId);
    const wardIds = staff.wards.map(w => w.wardId);

    if (clinicIds.length === 0 && wardIds.length === 0) {
      return res.json([]);
    }

    const journeys = await prisma.patientJourney.findMany({
      where: {
        status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
        OR: [
          { clinicId: { in: clinicIds } },
          { wardId: { in: wardIds } }
        ]
      },
      include: {
        patient: {
          select: {
            id: true,
            hospitalId: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            phone: true,
            email: true,
            address: true,
            emergencyContact: true,
            allergies: true,
            nextOfKinName: true,
            nextOfKinPhone: true,
            nextOfKinRelationship: true,
          }
        },
        clinic: true,
        ward: true,
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(journeys);
  } catch (error) {
    console.error('Error fetching nurse patients:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/:patientId/vitals', authenticate, async (req, res) => {
  try {
    const vitals = await prisma.vitalSign.findMany({
      where: { patientId: req.params.patientId },
      include: { nurse: { select: { firstName: true, lastName: true } } },
      orderBy: { recordedAt: 'desc' }
    });
    res.json(vitals);
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vitals', authenticate, authorize('Nurse', 'Midwife'), async (req, res) => {
  try {
    const {
      patientId,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      heartRate,
      temperature,
      respiratoryRate,
      oxygenSaturation,
      weight,
      height,
      notes
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const vital = await prisma.vitalSign.create({
      data: {
        patientId,
        nurseId: req.user.id,
        bloodPressureSystolic: bloodPressureSystolic ? parseInt(bloodPressureSystolic) : null,
        bloodPressureDiastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : null,
        oxygenSaturation: oxygenSaturation ? parseInt(oxygenSaturation) : null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        notes: notes || null,
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

// ============ NURSE ASSIGNMENT ENDPOINTS ============

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
  const staff = await prisma.staff.findUnique({
    where: { id: req.user.id },
    include: {
      clinics: { select: { clinicId: true } },
      wards: { select: { wardId: true } }
    }
  });
  const clinicIds = staff.clinics.map(c => c.clinicId);
  const wardIds = staff.wards.map(w => w.wardId);

  if (clinicIds.length === 0 && wardIds.length === 0) {
    return res.json([]);
  }

  const journeys = await prisma.patientJourney.findMany({
    where: {
      status: { in: ['SENT_TO_DESTINATION', 'COMPLETED'] },
      OR: [
        { clinicId: { in: clinicIds } },
        { wardId: { in: wardIds } }
      ]
    },
    include: {
      patient: {
        select: {
          id: true, hospitalId: true, firstName: true, lastName: true,
          gender: true, dateOfBirth: true, phone: true, email: true,
          address: true, emergencyContact: true, allergies: true,
          nextOfKinName: true, nextOfKinPhone: true, nextOfKinRelationship: true,
        }
      },
      clinic: true,
      ward: true,
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(journeys);
});

// ============ BILLING OFFICER ENDPOINTS ============

app.get('/api/billing-officer/pending', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const pendingJourneys = await prisma.patientJourney.findMany({
      where: { 
        status: 'PENDING_BILLING'
      },
      include: {
        patient: { 
          select: { 
            id: true,
            hospitalId: true, 
            firstName: true, 
            lastName: true,
            patientCategory: true,
            insuranceProvider: true,
            insuranceId: true,
            corporateCompany: true
          } 
        },
        clinic: { select: { name: true } },
        ward: { select: { name: true } },
        registeredBy: { select: { firstName: true, lastName: true } },
        billingRecord: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📋 Found ${pendingJourneys.length} pending journeys`);
    res.json(pendingJourneys);
  } catch (error) {
    console.error('Error fetching pending billing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/billing-officer/process-payment', authenticate, authorize('Admin', 'BillingOfficer', 'Accountant'), async (req, res) => {
  try {
    const { journeyId, paymentMethod } = req.body;

    if (!journeyId) {
      return res.status(400).json({ error: 'Journey ID is required' });
    }

    const journey = await prisma.patientJourney.findUnique({
      where: { id: journeyId },
      include: { patient: true, billingRecord: true }
    });

    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    if (journey.status !== 'PENDING_BILLING') {
      return res.status(400).json({ error: 'Journey is not in pending billing status' });
    }

    let bill = journey.billingRecord;

    if (!bill) {
      console.log('⚠️ No bill found, creating one...');
      
      let price = await prisma.servicePrice.findFirst({
        where: {
          OR: [
            { clinicId: journey.clinicId },
            { name: 'Consultation' }
          ],
          isActive: true
        }
      });
      const amount = price ? price.amount : 5000;
      const description = price ? price.name : 'General Consultation';
      
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const invoiceNumber = `INV-${new Date().getFullYear()}-${timestamp}-${random}`;
      
      bill = await prisma.billingRecord.create({
        data: {
          patientId: journey.patientId,
          invoiceNumber,
          description,
          amount,
          totalAmount: amount,
          status: 'Pending'
        }
      });
      
      await prisma.patientJourney.update({
        where: { id: journeyId },
        data: { billingRecordId: bill.id }
      });
      
      console.log('✅ Bill created and linked:', bill.invoiceNumber);
    }

    const updatedBill = await prisma.billingRecord.update({
      where: { id: bill.id },
      data: {
        status: 'Paid',
        paymentMethod: paymentMethod || 'Cash',
        paymentDate: new Date()
      }
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

// ============ ADMIN PERMISSIONS MANAGER ============

// Get all role permissions
app.get('/api/permissions', authenticate, async (req, res) => {
  try {
    let perms = await prisma.rolePermission.findMany();
    const allRoles = ['Admin', 'ITAdmin', 'ITSupport', 'Doctor', 'Nurse', 'Pharmacist', 'Accountant', 'Records', 'LabTechnician', 'Receptionist', 'BillingOfficer', 'Obstetrician', 'Midwife'];
    
    for (const role of allRoles) {
      if (!perms.some(p => p.role === role)) {
        const newPerm = await prisma.rolePermission.create({ 
          data: { 
            role,
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
            archivedPatients: false
          } 
        });
        perms.push(newPerm);
      }
    }
    res.json(perms);
  } catch (error) { 
    console.error('Get permissions error:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// Update a role's permissions
app.patch('/api/permissions/:role', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { role } = req.params;
    const updates = req.body;
    
    console.log(`📝 Updating permissions for role: ${role}`);
    console.log('📝 Updates:', updates);
    
    let perm = await prisma.rolePermission.findUnique({
      where: { role }
    });
    
    if (!perm) {
      perm = await prisma.rolePermission.create({
        data: { 
          role,
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
          archivedPatients: false
        }
      });
    }
    
    const updated = await prisma.rolePermission.update({
      where: { role },
      data: updates
    });
    
    console.log('✅ Permissions updated successfully');
    res.json(updated);
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ AUTO-ARCHIVE SCHEDULED JOB ============

async function autoArchivePatients() {
  console.log('🔄 Running auto-archive job...');
  
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const completedJourneys = await prisma.patientJourney.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          lte: threeDaysAgo
        }
      },
      select: {
        patientId: true,
        patient: {
          select: {
            isArchived: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        }
      },
      distinct: ['patientId']
    });

    const patientsToArchive = completedJourneys
      .filter(j => !j.patient.isArchived)
      .map(j => j.patient);

    console.log(`📊 Found ${patientsToArchive.length} patients to auto-archive`);

    let archivedCount = 0;
    for (const patient of patientsToArchive) {
      try {
        await prisma.patient.update({
          where: { id: patient.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            archivedReason: 'Auto-archived after 3 days of completion',
            archivedBy: null,
            autoArchived: true
          }
        });

        const journey = await prisma.patientJourney.findFirst({
          where: {
            patientId: patient.id,
            status: 'COMPLETED'
          },
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
            staffId: null,
            action: 'AUTO_ARCHIVE_PATIENT',
            module: 'System',
            details: `Auto-archived patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName} (3 days after completion)`
          }
        });

        archivedCount++;
        console.log(`✅ Auto-archived: ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}`);
      } catch (error) {
        console.error(`❌ Failed to archive patient ${patient.id}:`, error);
      }
    }

    console.log(`✅ Auto-archive completed. Archived ${archivedCount} patients.`);
    return { archivedCount, total: patientsToArchive.length };
  } catch (error) {
    console.error('Auto-archive error:', error);
    return { error: error.message };
  }
}

app.post('/api/system/auto-archive', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const result = await autoArchivePatients();
    res.json({ 
      message: 'Auto-archive job completed', 
      ...result 
    });
  } catch (error) {
    console.error('Manual auto-archive error:', error);
    res.status(500).json({ error: error.message });
  }
});

const cron = require('node-cron');

cron.schedule('0 */6 * * *', async () => {
  console.log(`🔄 Auto-archive job started at ${new Date().toISOString()}`);
  await autoArchivePatients();
});

cron.schedule('0 2 * * *', async () => {
  console.log(`🌙 Nightly auto-archive job started at ${new Date().toISOString()}`);
  await autoArchivePatients();
});

console.log('✅ Auto-archive scheduler started (runs every 6 hours)');
// ============ ADMIN PERMISSIONS MANAGER ============

// Get all role permissions
app.get('/api/permissions', authenticate, async (req, res) => {
  try {
    let perms = await prisma.rolePermission.findMany();
    const allRoles = ['Admin', 'ITAdmin', 'ITSupport', 'Doctor', 'Nurse', 'Pharmacist', 'Accountant', 'Records', 'LabTechnician', 'Receptionist', 'BillingOfficer', 'Obstetrician', 'Midwife'];
    
    for (const role of allRoles) {
      if (!perms.some(p => p.role === role)) {
        const newPerm = await prisma.rolePermission.create({ 
          data: { 
            role,
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
            archivedPatients: false
          } 
        });
        perms.push(newPerm);
      }
    }
    res.json(perms);
  } catch (error) { 
    console.error('Get permissions error:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// Update a role's permissions
app.patch('/api/permissions/:role', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { role } = req.params;
    const updates = req.body;
    
    console.log(`📝 Updating permissions for role: ${role}`);
    console.log('📝 Updates:', updates);
    
    let perm = await prisma.rolePermission.findUnique({
      where: { role }
    });
    
    if (!perm) {
      perm = await prisma.rolePermission.create({
        data: { 
          role,
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
          archivedPatients: false
        }
      });
    }
    
    const updated = await prisma.rolePermission.update({
      where: { role },
      data: updates
    });
    
    console.log('✅ Permissions updated successfully');
    res.json(updated);
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ AUTO-ARCHIVE SCHEDULED JOB ============

async function autoArchivePatients() {
  console.log('🔄 Running auto-archive job...');
  
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const completedJourneys = await prisma.patientJourney.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          lte: threeDaysAgo
        }
      },
      select: {
        patientId: true,
        patient: {
          select: {
            isArchived: true,
            hospitalId: true,
            firstName: true,
            lastName: true
          }
        }
      },
      distinct: ['patientId']
    });

    const patientsToArchive = completedJourneys
      .filter(j => !j.patient.isArchived)
      .map(j => j.patient);

    console.log(`📊 Found ${patientsToArchive.length} patients to auto-archive`);

    let archivedCount = 0;
    for (const patient of patientsToArchive) {
      try {
        await prisma.patient.update({
          where: { id: patient.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
            archivedReason: 'Auto-archived after 3 days of completion',
            archivedBy: null,
            autoArchived: true
          }
        });

        const journey = await prisma.patientJourney.findFirst({
          where: {
            patientId: patient.id,
            status: 'COMPLETED'
          },
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
            staffId: null,
            action: 'AUTO_ARCHIVE_PATIENT',
            module: 'System',
            details: `Auto-archived patient ${patient.hospitalId} - ${patient.firstName} ${patient.lastName} (3 days after completion)`
          }
        });

        archivedCount++;
        console.log(`✅ Auto-archived: ${patient.hospitalId} - ${patient.firstName} ${patient.lastName}`);
      } catch (error) {
        console.error(`❌ Failed to archive patient ${patient.id}:`, error);
      }
    }

    console.log(`✅ Auto-archive completed. Archived ${archivedCount} patients.`);
    return { archivedCount, total: patientsToArchive.length };
  } catch (error) {
    console.error('Auto-archive error:', error);
    return { error: error.message };
  }
}

app.post('/api/system/auto-archive', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    const result = await autoArchivePatients();
    res.json({ 
      message: 'Auto-archive job completed', 
      ...result 
    });
  } catch (error) {
    console.error('Manual auto-archive error:', error);
    res.status(500).json({ error: error.message });
  }
});

const cron = require('node-cron');

cron.schedule('0 */6 * * *', async () => {
  console.log(`🔄 Auto-archive job started at ${new Date().toISOString()}`);
  await autoArchivePatients();
});

cron.schedule('0 2 * * *', async () => {
  console.log(`🌙 Nightly auto-archive job started at ${new Date().toISOString()}`);
  await autoArchivePatients();
});

console.log('✅ Auto-archive scheduler started (runs every 6 hours)');

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
  console.log(`  👨‍⚕️ Staff: /api/staff (Admin & ITAdmin only)`);
  console.log(`  👤 Staff by ID: /api/staff/:id (Admin & ITAdmin)`);
  console.log(`  🔄 Update Staff: /api/staff/:id (Admin & ITAdmin)`);
  console.log(`  ❌ Deactivate Staff: /api/staff/:id (Admin & ITAdmin)`);
  console.log(`  🔄 Reactivate Staff: /api/staff/:id/reactivate (Admin & ITAdmin)`);
  console.log(`  🔑 Reset Password: /api/staff/:id/reset-password (Admin & ITAdmin)`);
  console.log(`  📅 Appointments: /api/appointments`);
  console.log(`  📝 Clinical Notes: /api/clinical-notes (POST restricted)`);
  console.log(`  💊 Prescriptions: /api/prescriptions`);
  console.log(`  🔬 Lab Orders: /api/lab-orders`);
  console.log(`  💰 Billing: /api/billing (GET with filters, POST create, PATCH update)`);
  console.log(`  💊 Pharmacy: /api/medications`);
  console.log(`  📊 Dashboard: /api/dashboard/stats`);
  console.log(`  🏥 Wards: /api/wards (GET, POST, DELETE)`);
  console.log(`  🏥 Clinics: /api/clinics (GET, POST, DELETE)`);
  console.log(`  📋 Patient Intake: /api/patient-journeys (GET, POST, PATCH)`);
  console.log(`  📋 ADT: /api/admissions (GET, POST, PATCH discharge/transfer)`);
  console.log(`  🖥️ System Status: /api/system/status (Admin & ITAdmin)`);
  console.log(`  📋 System Logs: /api/system/logs (Admin & ITAdmin)`);
  console.log(`  📈 User Activity: /api/system/user-activity (Admin & ITAdmin)`);
  console.log(`  💲 Service Pricing: /api/service-prices (GET view for BillingOfficer, POST/PUT/DELETE for Admin/ITAdmin/Accountant)`);
  console.log(`  💉 Nurse Vitals: /api/nurse/patients (Nurse/Admin/Midwife), /api/patients/:patientId/vitals, /api/vitals (Nurse)`);
  console.log(`  🩺 Doctor Patients: /api/doctor/patients (Doctor/Obstetrician only)`);
  console.log(`  🔐 Permissions: /api/permissions (Admin only)`);
  console.log(`  🤰 Antenatal: /api/pregnancies, /api/pregnancies/:id, /api/pregnancies/:id/visits, /api/deliveries (permission-based)`);
  console.log(`  📦 Archived Patients: /api/patients/archived (GET), /api/patients/:id/archive (POST), /api/patients/:id/unarchive (POST)`);
  console.log(`  🤖 Auto-Archive: /api/system/auto-archive (POST, Admin only)`);
  console.log('='.repeat(50));
});