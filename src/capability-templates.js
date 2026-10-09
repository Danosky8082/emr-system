// src/capability-templates.js
//
// Canonical set of capabilities seeded for every hospital.
// Capabilities are actions that require a certain seniority
// level to perform — separate from module access (RolePermission).
//
// minSeniority: 'JUNIOR' | 'STAFF' | 'SENIOR' | 'HOD' | 'ADMIN'

// Canonical list of capabilities
const ALL_CAPABILITIES = [
  // ── Records ────────────────────────────────────────────────
  {
    key: 'records.edit_contact_info',
    label: 'Edit patient contact info',
    description: 'Update phone, address, emergency contact',
    domain: 'Records',
  },
  {
    key: 'records.edit_identity',
    label: 'Edit patient identity',
    description: 'Change name, DOB, gender, or next-of-kin',
    domain: 'Records',
  },
  {
    key: 'records.delete_patient',
    label: 'Delete patient file',
    description: 'Soft-delete a patient (recoverable)',
    domain: 'Records',
  },

  // ── Billing ────────────────────────────────────────────────
  {
    key: 'billing.reverse_transaction',
    label: 'Reverse transaction (under threshold)',
    description: 'Reverse a completed payment below the approval threshold',
    domain: 'Billing',
  },
  {
    key: 'billing.reverse_large',
    label: 'Reverse large transaction',
    description: 'Reverse a payment above the approval threshold',
    domain: 'Billing',
  },
  {
    key: 'billing.void_receipt',
    label: 'Void receipt',
    description: 'Void a generated receipt',
    domain: 'Billing',
  },

  // ── Wallet ─────────────────────────────────────────────────
  {
    key: 'wallet.freeze',
    label: 'Freeze patient wallet',
    description: 'Set a patient wallet to Frozen or Closed',
    domain: 'Wallet',
  },

  // ── Pharmacy ───────────────────────────────────────────────
  // NOTE: pharmacy.transfer_main_store is deferred until the
  // two-store pharmacy feature is built. Do not add it back
  // until POST /api/pharmacy/main-store/transfer exists.
];

// Who gets each capability by default when a hospital is created.
// Structure: { role: { capabilityKey: minSeniority } }
const DEFAULT_ROLE_CAPABILITIES = {
  Admin: {
    'records.edit_contact_info': 'STAFF',
    'records.edit_identity': 'STAFF',
    'records.delete_patient': 'STAFF',
    'billing.reverse_transaction': 'STAFF',
    'billing.reverse_large': 'STAFF',
    'billing.void_receipt': 'STAFF',
    'wallet.freeze': 'STAFF',
  },
  ITAdmin: {
    'records.edit_contact_info': 'STAFF',
    'records.edit_identity': 'STAFF',
    'records.delete_patient': 'STAFF',
    'billing.reverse_transaction': 'STAFF',
    'billing.reverse_large': 'STAFF',
    'billing.void_receipt': 'STAFF',
    'wallet.freeze': 'STAFF',
  },
  Records: {
    'records.edit_contact_info': 'STAFF',
    'records.edit_identity': 'HOD',
    'records.delete_patient': 'HOD',
  },
  Accountant: {
    'billing.reverse_transaction': 'SENIOR',
    'billing.reverse_large': 'HOD',
    'billing.void_receipt': 'HOD',
    'wallet.freeze': 'HOD',
  },
  BillingOfficer: {
    'billing.reverse_transaction': 'HOD',
    'billing.reverse_large': 'HOD',
    'wallet.freeze': 'HOD',
  },
  // Pharmacist: no Wave-1 capabilities yet (main-store transfer deferred)
};

// Creates the RoleCapability rows for a new hospital
async function createDefaultRoleCapabilities(tx, hospitalId) {
  let created = 0;

  for (const [role, caps] of Object.entries(DEFAULT_ROLE_CAPABILITIES)) {
    for (const [capability, minSeniority] of Object.entries(caps)) {
      await tx.roleCapability.create({
        data: {
          tenantId: hospitalId,
          role,
          capability,
          minSeniority,
          isEnabled: true,
        },
      });
      created++;
    }
  }

  return created;
}

module.exports = {
  ALL_CAPABILITIES,
  DEFAULT_ROLE_CAPABILITIES,
  createDefaultRoleCapabilities,
};