// src/permission-templates.js
// Central source of truth for the default role-permission matrix.
// Used by:
//   - POST /api/super-admin/hospitals (server.js)
//   - POST /api/public/register-hospital (server.js)
//   - POST /api/platform/hospitals (src/routes/platform.js)
//   - POST /api/platform/backfill-permissions (src/routes/platform.js)

async function createDefaultRolePermissions(tx, hospitalId) {
  const allModules = [
    'dashboard','patients','staff','appointments','prescriptions','labOrders','billing',
    'pharmacy','pharmacyDashboard','pharmacyInventory','nhisManagement','nhisAuthorizations',
    'pharmacyStock','pharmacyTransactions','pharmacyBranches','clinics','wards','pricing',
    'billingOfficer','wallet','patientIntake','admissions','patientHistory','roiRequests',
    'nurseDashboard','doctorDashboard','antenatal','archivedPatients','archivedPatientsView',
    'queueManagement','doctorQueue','hrDashboard','hrEmployees','hrDepartments','hrLeaves',
    'hrAttendance','hrPerformance','hrTrainings','radiology','dental','optometry',
    'immunizations','patientPortal','portalSetup','laborAndDelivery',, 'analytics', 'staffActivity', 
  ];

  const base = Object.fromEntries(allModules.map((m) => [m, false]));
  const allTrue = Object.fromEntries(allModules.map((m) => [m, true]));

  const rolePerms = {
    // Admin roles
    Admin: allTrue,
    ITAdmin: allTrue,

    // HR
    HR: { ...base,
      dashboard: true, staff: true,
      hrDashboard: true, hrEmployees: true, hrDepartments: true,
      hrLeaves: true, hrAttendance: true, hrPerformance: true, hrTrainings: true,
      archivedPatients: true, archivedPatientsView: true, staffActivity: true,
    },

    // Clinical
    Doctor: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, labOrders: true,
      doctorDashboard: true, doctorQueue: true, patientHistory: true,
      archivedPatientsView: true, immunizations: true,
    },
    Nurse: { ...base,
      dashboard: true, patients: true,
      nurseDashboard: true, queueManagement: true,
      antenatal: true, laborAndDelivery: true,
      immunizations: true, archivedPatientsView: true,
    },

    // Maternity
    Obstetrician: { ...base,
      dashboard: true, patients: true, appointments: true,
      prescriptions: true, labOrders: true,
      doctorDashboard: true, doctorQueue: true,
      antenatal: true, laborAndDelivery: true,
      archivedPatientsView: true, immunizations: true,
    },
    Midwife: { ...base,
      dashboard: true, patients: true,
      nurseDashboard: true, queueManagement: true,
      antenatal: true, laborAndDelivery: true,
      archivedPatientsView: true, immunizations: true,
    },

    // Pharmacy
    Pharmacist: { ...base,
      dashboard: true, prescriptions: true,
      pharmacy: true, pharmacyDashboard: true, pharmacyInventory: true,
      pharmacyStock: true, pharmacyTransactions: true,
      nhisManagement: true, nhisAuthorizations: true,
    },

    // Laboratory
    LabTechnician: { ...base,
      dashboard: true, patients: true, labOrders: true,
    },
    LabScientist: { ...base,
      dashboard: true, patients: true, labOrders: true,
      patientHistory: true, archivedPatientsView: true,
    },

    // Imaging
    Radiologist: { ...base,
      dashboard: true, patients: true, radiology: true,
      archivedPatientsView: true,
    },

    // Specialists
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

    // Finance
    Accountant: { ...base,
      dashboard: true, billing: true, pricing: true, wallet: true,
      nhisManagement: true, nhisAuthorizations: true, staffActivity: true,
    },
    BillingOfficer: { ...base,
      dashboard: true, patients: true,
      billingOfficer: true, wallet: true,
    },

    // Records
    Records: { ...base,
      dashboard: true, patients: true,
      patientIntake: true, admissions: true, patientHistory: true,
      roiRequests: true, queueManagement: true, antenatal: true,
      archivedPatients: true, archivedPatientsView: true,
      patientPortal: true, portalSetup: true,
    },

    // Front desk
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

module.exports = { createDefaultRolePermissions };