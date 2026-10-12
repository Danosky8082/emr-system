// src/prisma-client.js
//
// Prisma client singleton + multi-tenant extension.
//
// This module loads .env itself so that ANY script which requires it
// (server.js, seed scripts, one-off test scripts, cron jobs) gets a
// working DATABASE_URL without having to remember to call dotenv.config().

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('');
  console.warn('⚠️  DATABASE_URL is not set. Prisma will fail to connect.');
  console.warn('   Check that .env exists at the project root and contains:');
  console.warn('     DATABASE_URL=postgresql://user:pass@host:port/dbname');
  console.warn('');
}

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
// Helper: does the caller's `where` use a compound unique key?
//
// Prisma's typed `update` and `delete` require a WhereUniqueInput,
// which accepts ONLY the model's declared unique fields (id, and
// any @@unique compound keys). If we inject a bare `tenantId`
// alongside `id`, Prisma throws a validation error.
//
// We detect the compound-key form by looking for any property
// that starts with `tenantId_` (e.g. `tenantId_email`,
// `tenantId_hospitalId`, `tenantId_role`).
// ============================================================
function hasCompoundUniqueKey(where) {
  if (!where || typeof where !== 'object') return false;
  return Object.keys(where).some((k) => k.startsWith('tenantId_'));
}

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
          // findUnique / findUniqueOrThrow → findFirst / findFirstOrThrow
          // ============================================================
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            if (hasCompoundUniqueKey(args.where)) {
              // Caller supplied the compound key explicitly — inject
              // tenantId as a safety net and run as-is.
              args.where = { ...args.where, tenantId };
              return query(args);
            }

            // No compound key supplied → fall back to findFirst
            const findFirstArgs = {
              ...args,
              where: { ...(args.where || {}), tenantId },
            };

            if (operation === 'findUniqueOrThrow') {
              return prisma[model].findFirstOrThrow(findFirstArgs);
            }
            return prisma[model].findFirst(findFirstArgs);
          }

          // ============================================================
          // Soft-delete filter for Patient reads
          // ============================================================
          if (model === 'Patient') {
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

          // ============================================================
          // READ operations — inject tenantId into WHERE
          // ============================================================
          if ([
            'findFirst', 'findMany', 'count',
            'aggregate', 'groupBy', 'findFirstOrThrow',
          ].includes(operation)) {
            args.where = { ...args.where, tenantId };
          }

          // ============================================================
          // UPDATE / DELETE — the tricky case
          //
          // Prisma's `update` and `delete` require a WhereUniqueInput.
          // If the caller passed only `{ id }`, we can't just add
          // `tenantId` to the same object — Prisma rejects it.
          //
          // Solution: rewrite to `updateMany` / `deleteMany` and then
          // fetch the affected row back with findFirst. This preserves
          // the "return the updated/removed object" contract that the
          // rest of the codebase expects.
          // ============================================================
          if (operation === 'update' || operation === 'delete') {
            // If the caller used a compound unique key, Prisma accepts
            // both `tenantId_...` AND `tenantId` as filters — but only
            // when the compound key is present. So we can just inject
            // tenantId and let Prisma run it.
            if (hasCompoundUniqueKey(args.where)) {
              args.where = { ...args.where, tenantId };
              return query(args);
            }

            // Plain `{ id }` (or `{ walletId }` etc.) — rewrite to Many.
            const whereWithTenant = { ...args.where, tenantId };

            if (operation === 'update') {
              const result = await prisma[model].updateMany({
                where: whereWithTenant,
                data: args.data,
              });

              if (result.count === 0) {
                const err = new Error(
                  `Prisma update failed: no ${model} record matched the given where clause within this tenant.`
                );
                err.code = 'P2025';
                throw err;
              }

              // Return the updated row with the same shape the caller
              // would have gotten from `update`.
              return prisma[model].findFirst({
                where: whereWithTenant,
                include: args.include,
                select: args.select,
              });
            }

            // operation === 'delete'
            // Snapshot the row so we can return it — Prisma's delete
            // returns the deleted row, and callers may depend on that.
            const rowToDelete = await prisma[model].findFirst({
              where: whereWithTenant,
            });

            if (!rowToDelete) {
              const err = new Error(
                `Prisma delete failed: no ${model} record matched the given where clause within this tenant.`
              );
              err.code = 'P2025';
              throw err;
            }

            await prisma[model].deleteMany({ where: whereWithTenant });

            return rowToDelete;
          }

          // ============================================================
          // updateMany / deleteMany — no unique constraint, so plain
          // tenantId injection works.
          // ============================================================
          if (operation === 'updateMany' || operation === 'deleteMany') {
            args.where = { ...args.where, tenantId };
          }

          // ============================================================
          // CREATE operations — inject tenantId into DATA
          // ============================================================
          if (operation === 'create') {
            args.data = { ...args.data, tenantId };
          }
          if (operation === 'createMany') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((d) => ({ ...d, tenantId }));
            } else {
              args.data = { ...args.data, tenantId };
            }
          }

          // ============================================================
          // UPSERT — inject tenantId into both create and where
          // ============================================================
          if (operation === 'upsert') {
            args.create = { ...args.create, tenantId };
            args.where = { ...args.where, tenantId };
          }

          return query(args);
        },
      },
    },
  });
}

module.exports = {
  prisma,           // Unscoped — use only for Hospital, HospitalSettings, RolePermission
  getTenantPrisma,  // Scoped — use for everything else
  TENANT_SCOPED_MODELS,
};