// src/prisma-client.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Base Prisma client (unscoped — use only for global operations)
const prisma = new PrismaClient({ adapter });

// ============================================================
// Models that are tenant-scoped
// Every query against these is auto-filtered by tenantId
// ============================================================
const TENANT_SCOPED_MODELS = [
  // ===== Core clinical =====
  'Staff', 'Patient', 'Department', 'Clinic', 'Ward', 'StaffClinic', 'StaffWard',
  'Appointment', 'AppointmentReminder', 'VitalSign', 'ClinicalNote',
  'Prescription', 'LabOrder', 'ImagingOrder', 'ImagingResult',
  'BillingRecord', 'PatientWallet', 'WalletTransaction',
  'PatientJourney', 'Admission', 'PatientQueue',
  'Medication', 'MedicationTransaction',
  'ServicePricing', 'ServiceConfiguration', 'ServicePrice',
  'Pregnancy', 'AntenatalVisit', 'Delivery',
  'PatientHistoryRecord', 'PatientMessage', 'PatientTransfer',
  'PaymentPlan', 'PartialPayment',

  // ===== NHIS =====
  'NHISAuthorization', 'NHISClaim', 'NHISDrugFormulary', 'NHISDrugPrice',

  // ===== Pharmacy =====
  'PharmacyBranch', 'PharmacyStaff', 'PharmacyTransaction',

  // ===== Kiosk / ROI / Audit =====
  // NOTE: RolePermission is intentionally EXCLUDED.
  // Its unique constraint is a compound (tenantId_role). Auto-injecting
  // tenantId into findUnique/update would break Prisma's unique-key validation.
  // Handle RolePermission queries explicitly (see server.js).
  'KioskSession', 'ROIRequest', 'AuditLog',

  // ===== Snake_case models (MUST match schema.prisma exactly) =====
  'attendance',
  'dental_records',
  'immunizations',
  'leave_notifications',
  'leave_policies',
  'leave_requests',
  'leave_usages',
  'optometry_records',
  'patient_notifications',
  'performance_reviews',
  'staff_leave_entitlements',
  'staff_trainings',
  'trainings',
];

// ============================================================
// Get a tenant-scoped Prisma client
// All queries on TENANT_SCOPED_MODELS auto-inject tenantId
// ============================================================
function getTenantPrisma(tenantId) {
  if (!tenantId) {
    throw new Error('tenantId is required for tenant-scoped operations');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Skip non-scoped models (Hospital, HospitalSettings, RolePermission, etc.)
          if (!TENANT_SCOPED_MODELS.includes(model)) {
            return query(args);
          }

          // ============================================================
          // ✅ SAFETY: convert findUnique → findFirst
          //
          // Prisma's findUnique requires an exact unique constraint name
          // (e.g. `tenantId_role: { tenantId, role }`). The tenant extension
          // only knows how to inject `tenantId` as a flat field — which
          // causes Prisma to reject the query with:
          //   "Argument `where` of type XWhereUniqueInput needs at least
          //    one of `id` or `tenantId_role` arguments"
          //
          // findFirst accepts ordinary filters and works with the
          // auto-injected tenantId. So we transparently fall back to it.
          // ============================================================
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            // If the caller supplied the compound unique key explicitly,
            // keep using findUnique — they know what they're doing.
            const hasCompoundKey = args.where && (
              args.where.tenantId_role !== undefined ||
              args.where.tenantId_email !== undefined ||
              args.where.tenantId_medicationId_nhisCode !== undefined ||
              args.where.tenantId_username !== undefined ||
              args.where.tenantId_employeeId !== undefined ||
              // add more compound key names here as your schema grows
              Object.keys(args.where).some(k => k.startsWith('tenantId_'))
            );

            if (hasCompoundKey) {
              // Let it run as findUnique — but still inject tenantId for safety
              args.where = { ...args.where, tenantId };
              return query(args);
            }

            // No compound key supplied → fall back to findFirst
            const findFirstArgs = {
              ...args,
              where: { ...(args.where || {}), tenantId },
            };

            // findUniqueOrThrow → findFirstOrThrow for semantic parity
            if (operation === 'findUniqueOrThrow') {
              return prisma[model].findFirstOrThrow(findFirstArgs);
            }
            return prisma[model].findFirst(findFirstArgs);
          }

          // ============================================================
          // Soft-delete filter for Patient reads
          // ============================================================
          if (model === 'Patient') {
            // ⚠️ groupBy is EXCLUDED — Prisma rejects auto-injected fields for groupBy
            const isReadOp = [
              'findFirst', 'findMany', 'count',
              'aggregate', 'findFirstOrThrow',
            ].includes(operation);

            if (isReadOp) {
              const alreadyFilters = args.where && 'deletedAt' in args.where;
              if (!alreadyFilters) {
                args.where = { ...args.where, deletedAt: null };
              }
            }
          }

          // READ operations — inject tenantId into WHERE
          if ([
            'findFirst', 'findMany', 'count',
            'aggregate', 'groupBy', 'findFirstOrThrow',
          ].includes(operation)) {
            args.where = { ...args.where, tenantId };
          }

          // UPDATE / DELETE operations — inject tenantId into WHERE
          if ([
            'update', 'updateMany', 'delete', 'deleteMany',
          ].includes(operation)) {
            args.where = { ...args.where, tenantId };
          }

          // CREATE operations — inject tenantId into DATA
          if (operation === 'create') {
            args.data = { ...args.data, tenantId };
          }
          if (operation === 'createMany') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(d => ({ ...d, tenantId }));
            } else {
              args.data = { ...args.data, tenantId };
            }
          }

          // UPSERT — inject tenantId into both create and where
          if (operation === 'upsert') {
            args.create = { ...args.create, tenantId };
            args.where = { ...args.where, tenantId };
          }

          return query(args);
        }
      }
    }
  });
}

module.exports = {
  prisma,           // Unscoped — use only for Hospital, HospitalSettings, RolePermission
  getTenantPrisma,  // Scoped — use for everything else
  TENANT_SCOPED_MODELS
};