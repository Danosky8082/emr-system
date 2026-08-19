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
  max: process.env.NODE_ENV === 'production' ? 100 : 1000 // 1000 for dev
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

      // ✅ Admin and ITAdmin bypass permission checks
      if (['Admin', 'ITAdmin'].includes(userRole)) {
        return next();
      }

      const rolePerm = await prisma.rolePermission.findUnique({
        where: { role: userRole },
        select: { [permissionKey]: true },
      });

      // ✅ If no permission record exists, create one with default false
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
            antenatal: false
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

// Register new staff
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

// Login - supports both email AND username
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

// Authentication middleware
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

// Role-based authorization middleware (Case-Insensitive)
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

// ============ PATIENT ENDPOINTS ============

// Create a new patient - Only Records, Admin, ITAdmin
app.post('/api/patients', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { 
      firstName, lastName, dateOfBirth, gender, phone, email, address, 
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone, nextOfKinRelationship 
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
            hospitalId, firstName, lastName, dateOfBirth: new Date(dateOfBirth), gender,
            phone, email, address, emergencyContact, allergies,
            nextOfKinName, nextOfKinPhone, nextOfKinRelationship 
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

// Get all patients - Allowed for Admin, Records, ITAdmin, BillingOfficer, Doctor, Nurse, Obstetrician, Midwife
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

// Get patient by ID - Enforce assignment for Nurses/Doctors
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

// Search patients - All authenticated users
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

// Edit Patient - Admin, Records, ITAdmin
app.put('/api/patients/:id', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      firstName, lastName, dateOfBirth, gender, phone, email, address, 
      emergencyContact, allergies, nextOfKinName, nextOfKinPhone, nextOfKinRelationship 
    } = req.body;

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        firstName, lastName, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender, phone, email, address, emergencyContact, allergies,
        nextOfKinName, nextOfKinPhone, nextOfKinRelationship
      }
    });
    res.json(patient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete Patient - Admin, Records, ITAdmin
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

// ============ STAFF MANAGEMENT ENDPOINTS (Admin & ITAdmin only) ============

// Get all staff - Admin and ITAdmin
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

// Get staff by ID - Admin and ITAdmin
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

// Create staff - Admin and ITAdmin
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

// Update staff - Admin and ITAdmin
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

// Deactivate staff - Admin and ITAdmin
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

// Reactivate staff - Admin and ITAdmin
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

// Reset staff password - Admin and ITAdmin
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

// Get all appointments - All authenticated users (including ITAdmin)
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

// Get appointments for a specific doctor - All authenticated users
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

// Create appointment - All authenticated users
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

// Update appointment status - All authenticated users
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

// Get all clinical notes for a patient - All authenticated users
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

// Create a clinical note (SOAP) - Clinical staff only
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

// Update a clinical note
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

// Delete a clinical note
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

// Get all prescriptions for a patient - All authenticated users
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

// Create a prescription - Doctor or Nurse only
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

// Dispense a prescription - Pharmacist only
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

// Get all lab orders for a patient - All authenticated users
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

// Create a lab order - Doctor or Nurse only
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

// Update lab order with results - Doctor or Nurse only
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

// Get all billing records for a patient - All authenticated users
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

// Get all billing records with filters - Admin, ITAdmin, Accountant, BillingOfficer
app.get('/api/billing', authenticate, authorize('Admin', 'ITAdmin', 'Accountant', 'BillingOfficer'), async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;

    // Build where clause
    let where = {};

    // Status filter
    if (status && status !== 'All') {
      where.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59');
    }

    // Search filter - by patient name, hospital ID, or invoice number
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
            phone: true
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

// Create a billing record - Admin, ITAdmin, Accountant only
app.post('/api/billing', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { patientId, description, amount, discount, tax, insuranceProvider } = req.body;

    if (!patientId || !description || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, description, amount'
      });
    }

    const discountValue = discount || 0;
    const taxValue = tax || 0;
    const totalAmount = amount - discountValue + taxValue;

    const count = await prisma.billingRecord.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const bill = await prisma.billingRecord.create({
      data: {
        patientId,
        invoiceNumber,
        description,
        amount,
        discount: discountValue,
        tax: taxValue,
        totalAmount,
        status: 'Pending',
        insuranceProvider
      },
      include: {
        patient: true
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'CREATE_BILL',
        module: 'Billing',
        details: `Created bill ${invoiceNumber} for patient ${bill.patient.hospitalId}`
      }
    });

    res.status(201).json(bill);
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Fetch a specific billing record for receipt printing
app.get('/api/billing/:id', authenticate, async (req, res) => {
  try {
    const bill = await prisma.billingRecord.findUnique({
      where: { id: req.params.id },
      include: { 
        patient: true 
      }
    });
    if (!bill) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json(bill);
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update bill payment - Admin, ITAdmin, Accountant only
app.patch('/api/billing/:id/pay', authenticate, authorize('Admin', 'ITAdmin', 'Accountant'), async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, insuranceClaimId } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const bill = await prisma.billingRecord.update({
      where: { id },
      data: {
        status: paymentMethod === 'Insurance' ? 'InsuranceClaim' : 'Paid',
        paymentMethod,
        paymentDate: new Date(),
        insuranceClaimId: paymentMethod === 'Insurance' ? insuranceClaimId : undefined
      },
      include: {
        patient: true
      }
    });

    await prisma.auditLog.create({
      data: {
        staffId: req.user.id,
        action: 'PAY_BILL',
        module: 'Billing',
        details: `Paid bill ${bill.invoiceNumber} via ${paymentMethod}`
      }
    });

    res.json(bill);
  } catch (error) {
    console.error('Pay bill error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ PHARMACY INVENTORY ENDPOINTS ============

// Get all medications - All authenticated users
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

// Get low stock medications - All authenticated users
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

// Create a medication - Admin, ITAdmin, Pharmacist only
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
        unitPrice,
        stockQuantity,
        reorderLevel: reorderLevel || 10,
        expiryDate: new Date(expiryDate),
        batchNumber
      }
    });

    await prisma.medicationTransaction.create({
      data: {
        medicationId: medication.id,
        transactionType: 'Purchase',
        quantity: stockQuantity,
        unitPrice,
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

// Update medication stock - Admin, ITAdmin, Pharmacist only
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

// Get audit logs - Admin and ITAdmin only
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

// ============ DASHBOARD STATISTICS (Role-Aware) ============

// Get dashboard statistics – adapted based on the logged‑in user's role
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

      console.log(`🛠️ [Stats Endpoint] Clinic IDs for ${req.user.role}:`, clinicIds);
      console.log(`🛠️ [Stats Endpoint] Ward IDs for ${req.user.role}:`, wardIds);

      // Get patients in assigned clinics/wards
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

      console.log(`📊 Found ${patientIds.length} patients in assigned areas`);

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

      // ✅ For Doctors & Obstetricians: No vitals - use prescriptions instead
      let prescriptionsCount = 0;
      let vitalsCount = 0;
      
      if (['Doctor', 'Obstetrician'].includes(role)) {
        // Doctors/Obstetricians: Count prescriptions they've written for their patients
        if (patientIds.length > 0) {
          prescriptionsCount = await prisma.prescription.count({
            where: { 
              patientId: { in: patientIds },
              prescribingStaffId: req.user.id
            }
          });
        }
        console.log(`💊 Found ${prescriptionsCount} prescriptions written by doctor`);
        
        // ✅ Build response for Doctors/Obstetricians - NO VITALS
        responseData = { 
          myPatientsCount, 
          myAppointmentsCount, 
          myPrescriptionsCount: prescriptionsCount
        };
      } else {
        // ✅ For Nurses & Midwives: Count vitals they recorded
        vitalsCount = await prisma.vitalSign.count({ 
          where: { nurseId: req.user.id } 
        });
        console.log(`❤️ Found ${vitalsCount} vitals recorded by nurse`);
        
        // ✅ Build response for Nurses/Midwives - WITH VITALS
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

// ============ SYSTEM STATUS ENDPOINTS (For IT Staff) ============

// Get system status - Admin and ITAdmin only
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

// Get system logs - Admin and ITAdmin only
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

// Get user activity summary - Admin and ITAdmin only
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

// Get all wards
app.get('/api/wards', authenticate, async (req, res) => {
  try {
    const wards = await prisma.ward.findMany({ orderBy: { name: 'asc' } });
    res.json(wards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create ward - Admin, ITAdmin only
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

// Delete ward - Admin, ITAdmin only
app.delete('/api/wards/:id', authenticate, authorize('Admin', 'ITAdmin'), async (req, res) => {
  try {
    await prisma.ward.delete({ where: { id: req.params.id } });
    res.json({ message: 'Ward deleted' });
  } catch (error) {
    res.status(400).json({ error: 'Cannot delete ward, it may have active admissions' });
  }
});

// ============ CLINIC MANAGEMENT (Admin Only) ============

// Get all clinics - All authenticated users (Records need to view them)
app.get('/api/clinics', authenticate, async (req, res) => {
  try {
    const clinics = await prisma.clinic.findMany({ orderBy: { name: 'asc' } });
    res.json(clinics);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Create clinic - Admin only
app.post('/api/clinics', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { name, description, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Clinic name is required' });
    const clinic = await prisma.clinic.create({ data: { name, description, location } });
    res.status(201).json(clinic);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Delete clinic - Admin only
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

// ============ PATIENT INTAKE & JOURNEY (Records Staff) ============

// Get all active patient journeys (Pipeline)
app.get('/api/patient-journeys', authenticate, authorize('Admin', 'Records'), async (req, res) => {
  try {
    const journeys = await prisma.patientJourney.findMany({
      include: {
        patient: { select: { firstName: true, lastName: true, hospitalId: true, gender: true, dateOfBirth: true } },
        clinic: true,
        ward: true,
        registeredBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(journeys);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Start a new patient journey (Records registers patient and sends to destination)
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

// Update journey status – Includes auto‑invoicing when status becomes PENDING_BILLING
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
        let price = await prisma.servicePrice.findFirst({
          where: {
            OR: [
              { clinicId: existingJourney.clinicId },
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

        console.log('📄 Creating bill - Invoice:', invoiceNumber, 'Amount:', amount);

        bill = await prisma.billingRecord.create({
          data: {
            patientId: existingJourney.patientId,
            invoiceNumber,
            description,
            amount,
            totalAmount: amount,
            status: 'Pending'
          }
        });

        console.log('✅ Bill created:', bill.id, 'Invoice:', bill.invoiceNumber);

        updateData.billingRecordId = bill.id;
        console.log('🔗 Linking bill to journey');
      } else {
        console.log('ℹ️ Bill already exists:', bill.invoiceNumber);
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

// ============ PATIENT INTAKE - REVERSE/UNDO ENDPOINTS ============

// ============ PATIENT INTAKE - REVERSE/UNDO ENDPOINTS ============

// Reverse a completed journey (undo COMPLETED status)
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

    // ✅ Only allow reversing from COMPLETED or SENT_TO_DESTINATION
    if (!['COMPLETED', 'SENT_TO_DESTINATION'].includes(journey.status)) {
      return res.status(400).json({ 
        error: 'Only COMPLETED or SENT_TO_DESTINATION journeys can be reversed' 
      });
    }

    // ✅ Reverse to previous status based on destination type
    let newStatus = 'SENT_TO_DESTINATION';

    // If the journey has a billing record, handle it
    if (journey.billingRecordId) {
      // Keep the bill but reset its status to Pending
      await prisma.billingRecord.update({
        where: { id: journey.billingRecordId },
        data: { 
          status: 'Pending',
          paymentMethod: null,
          paymentDate: null
        }
      });
    }

    // If there's an admission, discharge it
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

    // Update the journey
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

    // Audit log
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

// Reprint patient card (if already printed)
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

    // ✅ Only allow reprint if card was already printed
    if (!journey.cardGeneratedAt) {
      return res.status(400).json({ 
        error: 'Card has not been printed yet. Please mark as CARD_PRINTED first.' 
      });
    }

    // ✅ Update the card generation timestamp (for reprint tracking)
    const updatedJourney = await prisma.patientJourney.update({
      where: { id },
      data: { 
        cardGeneratedAt: new Date() // Update to current time
      },
      include: { patient: true }
    });

    // Audit log
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

// Return patient to a previous stage (for errors)
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

    // ✅ Prevent moving forward (only backward)
    const statusOrder = ['REGISTERED', 'PENDING_BILLING', 'BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(journey.status);
    const targetIndex = statusOrder.indexOf(targetStatus);

    if (targetIndex >= currentIndex) {
      return res.status(400).json({ 
        error: 'Can only return to a previous stage (not forward)' 
      });
    }

    // ✅ Clear related data based on target status
    let updateData = { status: targetStatus };
    
    if (targetStatus === 'REGISTERED') {
      // Clear everything
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

    // Audit log
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

// Get all admissions - All authenticated users
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

// Create a new admission - Records, Admin, ITAdmin
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

// Discharge a patient
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

// Transfer a patient
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

// ============ PATIENT HISTORY & MEDICAL CODING ============

// Search & Get Patient History
app.get('/api/patients/history', authenticate, async (req, res) => {
  try {
    const { search } = req.query;

    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { hospitalId: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } }
        ]
      },
      select: { id: true, hospitalId: true, firstName: true, lastName: true }
    });

    if (patients.length === 0) return res.json([]);

    const patientIds = patients.map(p => p.id);

    const historyRecords = await prisma.patientHistoryRecord.findMany({
      where: { patientId: { in: patientIds } },
      include: {
        patient: { select: { hospitalId: true, firstName: true, lastName: true } }
      },
      orderBy: { encounterDate: 'desc' }
    });

    res.json(historyRecords);
  } catch (error) {
    console.error('Patient history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new medical coding / history record - Records only
app.post('/api/patients/history', authenticate, authorize('Admin', 'Records', 'ITAdmin'), async (req, res) => {
  try {
    const { patientId, doctorName, encounterType, diagnosis, icd10Code, notes } = req.body;

    if (!patientId || !doctorName || !diagnosis) {
      return res.status(400).json({ error: 'Missing required fields: patientId, doctorName, diagnosis' });
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

// Get all ROI requests - All authenticated users (view only)
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

// Create ROI Request - Records, Admin, ITAdmin
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

// Update ROI Request Status - Records, Admin, ITAdmin
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

// ============ NURSE ENDPOINTS ============

// Get patients currently in the nurse's assigned clinics/wards
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

// Get vitals for a patient
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

// Record a new vital sign
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

// ============ NURSE ASSIGNMENT ENDPOINTS (Admin Only) ============

// Get a staff member's assigned clinics and wards
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

// Assign a clinic to a staff member
app.post('/api/staff/:staffId/clinics', authenticate, authorize('Admin'), async (req, res) => {
  const { clinicId } = req.body;
  await prisma.staffClinic.create({
    data: { staffId: req.params.staffId, clinicId }
  });
  res.json({ message: 'Clinic assigned' });
});

// Remove a clinic assignment
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

// Assign a ward to a staff member
app.post('/api/staff/:staffId/wards', authenticate, authorize('Admin'), async (req, res) => {
  const { wardId } = req.body;
  await prisma.staffWard.create({
    data: { staffId: req.params.staffId, wardId }
  });
  res.json({ message: 'Ward assigned' });
});

// Remove a ward assignment
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

// Get patients assigned to the doctor's clinics/wards
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

// Get all patient journeys pending billing (shows the pending invoices)
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
            lastName: true 
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
    pendingJourneys.forEach(j => {
      console.log(`  - Journey ${j.id}: Bill ${j.billingRecord?.invoiceNumber || 'NONE'}`);
    });

    res.json(pendingJourneys);
  } catch (error) {
    console.error('Error fetching pending billing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process payment – updates the pending bill to Paid and journey to BILLING_CLEARED
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

// ============ SERVICE PRICING (Admin Only) ============

// Get all service prices
app.get('/api/service-prices', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const prices = await prisma.servicePrice.findMany({ include: { clinic: true } });
    res.json(prices);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Create a new service price
app.post('/api/service-prices', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { name, description, amount, clinicId } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Name and Amount required' });
    
    const finalClinicId = (clinicId && clinicId !== '') ? clinicId : null;

    if (finalClinicId) {
      const clinicExists = await prisma.clinic.findUnique({
        where: { id: finalClinicId }
      });
      if (!clinicExists) {
        return res.status(400).json({ error: 'Invalid clinic ID provided.' });
      }
    }

    const price = await prisma.servicePrice.create({
      data: {
        name,
        description,
        amount: parseFloat(amount),
        clinicId: finalClinicId
      }
    });
    res.status(201).json(price);
  } catch (error) {
    console.error('Create service price error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update a service price
app.put('/api/service-prices/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { name, description, amount, clinicId } = req.body;
    
    const finalClinicId = (clinicId && clinicId !== '') ? clinicId : null;

    if (finalClinicId) {
      const clinicExists = await prisma.clinic.findUnique({
        where: { id: finalClinicId }
      });
      if (!clinicExists) {
        return res.status(400).json({ error: 'Invalid clinic ID provided.' });
      }
    }

    const price = await prisma.servicePrice.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        amount: parseFloat(amount),
        clinicId: finalClinicId
      }
    });
    res.json(price);
  } catch (error) {
    console.error('Update service price error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete a service price
app.delete('/api/service-prices/:id', authenticate, authorize('Admin'), async (req, res) => {
  try { await prisma.servicePrice.delete({ where: { id: req.params.id } }); res.json({ message: 'Deleted' }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

// ============ ADMIN PERMISSIONS MANAGER ============

// Get all role permissions
app.get('/api/permissions', authenticate, async (req, res) => {
  try {
    let perms = await prisma.rolePermission.findMany();
    const allRoles = ['Admin', 'ITAdmin', 'ITSupport', 'Doctor', 'Nurse', 'Pharmacist', 'Accountant', 'Records', 'LabTechnician', 'Receptionist', 'BillingOfficer', 'Obstetrician', 'Midwife'];
    for (const role of allRoles) {
      if (!perms.some(p => p.role === role)) {
        const newPerm = await prisma.rolePermission.create({ data: { role } });
        perms.push(newPerm);
      }
    }
    res.json(perms);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Update a role's permissions
app.patch('/api/permissions/:role', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { role } = req.params;
    const updates = req.body;
    const perm = await prisma.rolePermission.update({
      where: { role },
      data: updates
    });
    res.json(perm);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ============ ANTENATAL MODULE ENDPOINTS (Permission-based) ============

// Get all pregnancies – uses checkPermission('antenatal')
app.get('/api/pregnancies', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const role = req.user.role;
    console.log(`🔍 Fetching pregnancies for role: ${role}`);
    
    // ✅ RESTRICT: Only these roles can access antenatal
    const allowedRoles = ['Admin', 'ITAdmin', 'Records', 'Obstetrician', 'Midwife', 'Nurse'];
    if (!allowedRoles.includes(role)) {
      console.log(`⛔ Role ${role} not allowed to access antenatal`);
      return res.status(403).json({ 
        error: 'Access denied. Only Obstetricians, Midwives, Nurses, and administrators can access antenatal records.' 
      });
    }
    
    // ✅ RESTRICT: Regular Doctors (not Obstetrician) cannot access
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

    // For Nurse and Midwife roles, filter by assigned clinics/wards
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

// Get a single pregnancy – uses checkPermission('antenatal')
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

// Create a new pregnancy – uses checkPermission('antenatal')
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
        riskLevel,
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

// Update pregnancy – uses checkPermission('antenatal')
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

// Add an antenatal visit – uses checkPermission('antenatal')
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

// Record delivery – uses checkPermission('antenatal')
app.post('/api/deliveries', authenticate, checkPermission('antenatal'), async (req, res) => {
  try {
    const { pregnancyId, deliveryDate, type, durationHours, babyGender, babyWeight, babyApgar, outcome, notes } = req.body;

    if (!pregnancyId || !type || !babyGender) {
      return res.status(400).json({ error: 'Pregnancy ID, delivery type, and baby gender are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create delivery record
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

      // 2. Update pregnancy status to Delivered
      await tx.pregnancy.update({
        where: { id: pregnancyId },
        data: { status: 'Delivered' }
      });

      const mother = delivery.pregnancy.patient;
      
      // 3. Generate unique hospital ID for baby
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
      
      // 4. Generate unique hospital ID with retry
      while (attempts < 5) {
        babyHospitalId = ((nextIdNumber * 9301 + 12345) % 1000000)
          .toString()
          .padStart(6, '0');
        
        try {
          // Check if this hospitalId already exists
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

      // 5. Generate unique email for baby
      let babyEmail;
      const emailPrefix = `baby_${babyHospitalId}`;
      
      if (mother.email) {
        const domain = mother.email.split('@')[1] || 'hospital.com';
        babyEmail = `${emailPrefix}@${domain}`;
      } else {
        babyEmail = `${emailPrefix}@hospital.com`;
      }
      
      // 6. Check if email already exists and make it unique if needed
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

      // 7. Create baby patient record
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

      // 8. Find or create Paediatrics clinic
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

      // 9. Create patient journey for baby to Paediatrics
      await tx.patientJourney.create({
        data: {
          patientId: baby.id,
          destinationType: 'CLINIC',
          clinicId: paediatricsClinic.id,
          registeredById: req.user.id,
          status: 'SENT_TO_DESTINATION'
        }
      });

      // 10. Create audit log
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
  console.log(`  📋 Reverse Journey: /api/patient-journeys/:id/reverse (PATCH)`);
  console.log(`  📋 Reprint Card: /api/patient-journeys/:id/reprint-card (POST)`);
  console.log(`  📋 Return to Stage: /api/patient-journeys/:id/return-to-stage (PATCH)`);
  console.log(`  📋 ADT: /api/admissions (GET, POST, PATCH discharge/transfer)`);
  console.log(`  🖥️ System Status: /api/system/status (Admin & ITAdmin)`);
  console.log(`  📋 System Logs: /api/system/logs (Admin & ITAdmin)`);
  console.log(`  📈 User Activity: /api/system/user-activity (Admin & ITAdmin)`);
  console.log(`  💲 Service Pricing: /api/service-prices (Admin only)`);
  console.log(`  💉 Nurse Vitals: /api/nurse/patients (Nurse/Admin/Midwife), /api/patients/:patientId/vitals, /api/vitals (Nurse)`);
  console.log(`  🩺 Doctor Patients: /api/doctor/patients (Doctor/Obstetrician only)`);
  console.log(`  🔐 Permissions: /api/permissions (Admin only)`);
  console.log(`  🤰 Antenatal: /api/pregnancies, /api/pregnancies/:id, /api/pregnancies/:id/visits, /api/deliveries (permission-based)`);
  console.log('='.repeat(50));
});