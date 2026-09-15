/*
  Warnings:

  - The primary key for the `StaffClinic` table will be changed.
  - The primary key for the `StaffWard` table will be changed.
  - The primary key for the `staff_trainings` table will be changed.
  - Several unique constraints will be replaced with tenant-scoped composites.
*/

-- ============================================================
-- STEP 1: Create Hospital and HospitalSettings tables
-- ============================================================

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f3460',
    "secondaryColor" TEXT NOT NULL DEFAULT '#1a4a7a',
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "status" TEXT NOT NULL DEFAULT 'active',
    "trialEndsAt" TIMESTAMP(3),
    "subscriptionEndsAt" TIMESTAMP(3),
    "maxStaff" INTEGER NOT NULL DEFAULT 50,
    "maxPatients" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "registrationFee" DOUBLE PRECISION NOT NULL DEFAULT 2000,
    "cardFee" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "nhisMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "retainerMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "autoArchiveHours" INTEGER NOT NULL DEFAULT 24,
    "appointmentDuration" INTEGER NOT NULL DEFAULT 30,
    "enablePatientPortal" BOOLEAN NOT NULL DEFAULT true,
    "enableKioskMode" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsSenderId" TEXT,
    "emailSenderName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "currencySymbol" TEXT NOT NULL DEFAULT '₦',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalSettings_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- STEP 2: Insert default hospital (tenant) for existing data
-- ============================================================

INSERT INTO "Hospital" (
  "id", "name", "slug", "code", "country", "plan", "status",
  "maxStaff", "maxPatients", "isActive", "primaryColor", "secondaryColor",
  "createdAt", "updatedAt"
) VALUES (
  'default-hospital-id', 'Default Hospital', 'default-hospital', 'DFLT001',
  'Nigeria', 'trial', 'active', 50, 1000, true, '#0f3460', '#1a4a7a',
  NOW(), NOW()
);

INSERT INTO "HospitalSettings" (
  "id", "tenantId", "hospitalId",
  "registrationFee", "cardFee", "consultationFee",
  "nhisMultiplier", "retainerMultiplier",
  "autoArchiveHours", "appointmentDuration",
  "enablePatientPortal", "enableKioskMode",
  "smsEnabled", "emailEnabled",
  "currency", "currencySymbol", "timezone", "dateFormat",
  "createdAt", "updatedAt"
) VALUES (
  'default-settings-id', 'default-hospital-id', 'default-hospital-id',
  2000, 1000, 5000, 0.1, 2.0, 24, 30,
  true, true, false, false,
  'NGN', '₦', 'Africa/Lagos', 'DD/MM/YYYY',
  NOW(), NOW()
);

-- ============================================================
-- STEP 3: Drop old single-column unique indexes
-- ============================================================

DROP INDEX "Admission_admissionNumber_key";
DROP INDEX "BillingRecord_invoiceNumber_key";
DROP INDEX "BillingRecord_paymentReference_key";
DROP INDEX "BillingRecord_receiptNumber_key";
DROP INDEX "Clinic_name_key";
DROP INDEX "Department_name_key";
DROP INDEX "ImagingOrder_orderNumber_key";
DROP INDEX "NHISAuthorization_authorizationNumber_key";
DROP INDEX "NHISClaim_claimNumber_key";
DROP INDEX "NHISDrugFormulary_medicationId_nhisCode_key";
DROP INDEX "NHISDrugFormulary_nhisCode_key";
DROP INDEX "NHISDrugPrice_medicationId_nhisCode_key";
DROP INDEX "Patient_email_key";
DROP INDEX "Patient_hospitalId_key";
DROP INDEX "PatientTransfer_transferNumber_key";
DROP INDEX "PharmacyBranch_code_key";
DROP INDEX "PharmacyStaff_pharmacyId_staffId_key";
DROP INDEX "PharmacyTransaction_transactionNumber_key";
DROP INDEX "RolePermission_role_key";
DROP INDEX "ServiceConfiguration_serviceType_key";
DROP INDEX "ServicePricing_name_key";
DROP INDEX "Staff_email_key";
DROP INDEX "Staff_employeeId_key";
DROP INDEX "Staff_username_key";
DROP INDEX "WalletTransaction_paymentReference_key";
DROP INDEX "WalletTransaction_reference_key";
DROP INDEX "Ward_name_key";
DROP INDEX "leave_policies_name_key";
DROP INDEX "staff_leave_entitlements_staff_id_year_key";

-- ============================================================
-- STEP 4: Add tenantId column to every tenant-scoped table
-- with a DEFAULT so existing rows get assigned to default hospital
-- ============================================================

ALTER TABLE "Admission" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "AntenatalVisit" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Appointment" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "AppointmentReminder" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "BillingRecord" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Clinic" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "ClinicalNote" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Delivery" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Department" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "ImagingOrder" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "ImagingResult" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "KioskSession" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "LabOrder" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Medication" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "MedicationTransaction" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "NHISAuthorization" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "NHISClaim" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "NHISDrugFormulary" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "NHISDrugPrice" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PartialPayment" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Patient" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PatientHistoryRecord" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PatientJourney" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PatientMessage" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PatientQueue" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PatientTransfer" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PatientWallet" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PaymentPlan" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PharmacyBranch" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PharmacyStaff" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "PharmacyTransaction" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Pregnancy" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Prescription" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "ROIRequest" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "RolePermission" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "ServiceConfiguration" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "ServicePrice" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "ServicePricing" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Staff" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "VitalSign" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "WalletTransaction" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "Ward" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "attendance" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "dental_records" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "immunizations" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "leave_notifications" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "leave_policies" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "leave_requests" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "leave_usages" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "optometry_records" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "patient_notifications" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "performance_reviews" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "staff_leave_entitlements" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';
ALTER TABLE "trainings" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id';

-- Special cases: compound PK tables
ALTER TABLE "StaffClinic" 
  DROP CONSTRAINT "StaffClinic_pkey",
  ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id',
  ADD CONSTRAINT "StaffClinic_pkey" PRIMARY KEY ("tenantId", "staffId", "clinicId");

ALTER TABLE "StaffWard" 
  DROP CONSTRAINT "StaffWard_pkey",
  ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id',
  ADD CONSTRAINT "StaffWard_pkey" PRIMARY KEY ("tenantId", "staffId", "wardId");

ALTER TABLE "staff_trainings" 
  DROP CONSTRAINT "staff_trainings_pkey",
  ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default-hospital-id',
  ADD CONSTRAINT "staff_trainings_pkey" PRIMARY KEY ("tenantId", "staff_id", "training_id");

-- ============================================================
-- STEP 5: Create new composite unique indexes
-- ============================================================

CREATE UNIQUE INDEX "Hospital_slug_key" ON "Hospital"("slug");
CREATE UNIQUE INDEX "Hospital_code_key" ON "Hospital"("code");
CREATE UNIQUE INDEX "HospitalSettings_tenantId_key" ON "HospitalSettings"("tenantId");
CREATE UNIQUE INDEX "HospitalSettings_hospitalId_key" ON "HospitalSettings"("hospitalId");

CREATE INDEX "Admission_tenantId_idx" ON "Admission"("tenantId");
CREATE UNIQUE INDEX "Admission_tenantId_admissionNumber_key" ON "Admission"("tenantId", "admissionNumber");

CREATE INDEX "AntenatalVisit_tenantId_idx" ON "AntenatalVisit"("tenantId");

CREATE INDEX "Appointment_tenantId_idx" ON "Appointment"("tenantId");
CREATE INDEX "Appointment_tenantId_status_idx" ON "Appointment"("tenantId", "status");

CREATE INDEX "AppointmentReminder_tenantId_idx" ON "AppointmentReminder"("tenantId");

CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");

CREATE INDEX "BillingRecord_tenantId_idx" ON "BillingRecord"("tenantId");
CREATE INDEX "BillingRecord_tenantId_status_idx" ON "BillingRecord"("tenantId", "status");
CREATE UNIQUE INDEX "BillingRecord_tenantId_invoiceNumber_key" ON "BillingRecord"("tenantId", "invoiceNumber");
CREATE UNIQUE INDEX "BillingRecord_tenantId_paymentReference_key" ON "BillingRecord"("tenantId", "paymentReference");
CREATE UNIQUE INDEX "BillingRecord_tenantId_receiptNumber_key" ON "BillingRecord"("tenantId", "receiptNumber");

CREATE INDEX "Clinic_tenantId_idx" ON "Clinic"("tenantId");
CREATE UNIQUE INDEX "Clinic_tenantId_name_key" ON "Clinic"("tenantId", "name");

CREATE INDEX "ClinicalNote_tenantId_idx" ON "ClinicalNote"("tenantId");

CREATE INDEX "Delivery_tenantId_idx" ON "Delivery"("tenantId");

CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");

CREATE INDEX "ImagingOrder_tenantId_idx" ON "ImagingOrder"("tenantId");
CREATE INDEX "ImagingOrder_tenantId_status_idx" ON "ImagingOrder"("tenantId", "status");
CREATE INDEX "ImagingOrder_tenantId_patientId_idx" ON "ImagingOrder"("tenantId", "patientId");
CREATE UNIQUE INDEX "ImagingOrder_tenantId_orderNumber_key" ON "ImagingOrder"("tenantId", "orderNumber");

CREATE INDEX "ImagingResult_tenantId_idx" ON "ImagingResult"("tenantId");
CREATE INDEX "KioskSession_tenantId_idx" ON "KioskSession"("tenantId");

CREATE INDEX "LabOrder_tenantId_idx" ON "LabOrder"("tenantId");
CREATE INDEX "LabOrder_tenantId_status_idx" ON "LabOrder"("tenantId", "status");

CREATE INDEX "Medication_tenantId_idx" ON "Medication"("tenantId");
CREATE INDEX "Medication_tenantId_name_idx" ON "Medication"("tenantId", "name");

CREATE INDEX "MedicationTransaction_tenantId_idx" ON "MedicationTransaction"("tenantId");

CREATE INDEX "NHISAuthorization_tenantId_idx" ON "NHISAuthorization"("tenantId");
CREATE UNIQUE INDEX "NHISAuthorization_tenantId_authorizationNumber_key" ON "NHISAuthorization"("tenantId", "authorizationNumber");

CREATE INDEX "NHISClaim_tenantId_idx" ON "NHISClaim"("tenantId");
CREATE UNIQUE INDEX "NHISClaim_tenantId_claimNumber_key" ON "NHISClaim"("tenantId", "claimNumber");

CREATE INDEX "NHISDrugFormulary_tenantId_idx" ON "NHISDrugFormulary"("tenantId");
CREATE UNIQUE INDEX "NHISDrugFormulary_tenantId_nhisCode_key" ON "NHISDrugFormulary"("tenantId", "nhisCode");
CREATE UNIQUE INDEX "NHISDrugFormulary_tenantId_medicationId_nhisCode_key" ON "NHISDrugFormulary"("tenantId", "medicationId", "nhisCode");

CREATE INDEX "NHISDrugPrice_tenantId_idx" ON "NHISDrugPrice"("tenantId");
CREATE UNIQUE INDEX "NHISDrugPrice_tenantId_medicationId_nhisCode_key" ON "NHISDrugPrice"("tenantId", "medicationId", "nhisCode");

CREATE INDEX "PartialPayment_tenantId_idx" ON "PartialPayment"("tenantId");

CREATE INDEX "Patient_tenantId_idx" ON "Patient"("tenantId");
CREATE INDEX "Patient_tenantId_isArchived_idx" ON "Patient"("tenantId", "isArchived");
CREATE INDEX "Patient_tenantId_fileStatus_idx" ON "Patient"("tenantId", "fileStatus");
CREATE INDEX "Patient_tenantId_isDischarged_idx" ON "Patient"("tenantId", "isDischarged");
CREATE UNIQUE INDEX "Patient_tenantId_hospitalId_key" ON "Patient"("tenantId", "hospitalId");
CREATE UNIQUE INDEX "Patient_tenantId_email_key" ON "Patient"("tenantId", "email");

CREATE INDEX "PatientHistoryRecord_tenantId_idx" ON "PatientHistoryRecord"("tenantId");

CREATE INDEX "PatientJourney_tenantId_idx" ON "PatientJourney"("tenantId");
CREATE INDEX "PatientJourney_tenantId_status_idx" ON "PatientJourney"("tenantId", "status");

CREATE INDEX "PatientMessage_tenantId_idx" ON "PatientMessage"("tenantId");

CREATE INDEX "PatientQueue_tenantId_idx" ON "PatientQueue"("tenantId");
CREATE INDEX "PatientQueue_tenantId_status_idx" ON "PatientQueue"("tenantId", "status");

CREATE INDEX "PatientTransfer_tenantId_idx" ON "PatientTransfer"("tenantId");
CREATE UNIQUE INDEX "PatientTransfer_tenantId_transferNumber_key" ON "PatientTransfer"("tenantId", "transferNumber");

CREATE INDEX "PatientWallet_tenantId_idx" ON "PatientWallet"("tenantId");
CREATE INDEX "PaymentPlan_tenantId_idx" ON "PaymentPlan"("tenantId");

CREATE INDEX "PharmacyBranch_tenantId_idx" ON "PharmacyBranch"("tenantId");
CREATE UNIQUE INDEX "PharmacyBranch_tenantId_code_key" ON "PharmacyBranch"("tenantId", "code");

CREATE INDEX "PharmacyStaff_tenantId_idx" ON "PharmacyStaff"("tenantId");
CREATE UNIQUE INDEX "PharmacyStaff_tenantId_pharmacyId_staffId_key" ON "PharmacyStaff"("tenantId", "pharmacyId", "staffId");

CREATE INDEX "PharmacyTransaction_tenantId_idx" ON "PharmacyTransaction"("tenantId");
CREATE UNIQUE INDEX "PharmacyTransaction_tenantId_transactionNumber_key" ON "PharmacyTransaction"("tenantId", "transactionNumber");

CREATE INDEX "Pregnancy_tenantId_idx" ON "Pregnancy"("tenantId");

CREATE INDEX "Prescription_tenantId_idx" ON "Prescription"("tenantId");
CREATE INDEX "Prescription_tenantId_status_idx" ON "Prescription"("tenantId", "status");

CREATE INDEX "ROIRequest_tenantId_idx" ON "ROIRequest"("tenantId");

CREATE INDEX "RolePermission_tenantId_idx" ON "RolePermission"("tenantId");
CREATE UNIQUE INDEX "RolePermission_tenantId_role_key" ON "RolePermission"("tenantId", "role");

CREATE INDEX "ServiceConfiguration_tenantId_idx" ON "ServiceConfiguration"("tenantId");
CREATE UNIQUE INDEX "ServiceConfiguration_tenantId_serviceType_key" ON "ServiceConfiguration"("tenantId", "serviceType");

CREATE INDEX "ServicePrice_tenantId_idx" ON "ServicePrice"("tenantId");

CREATE INDEX "ServicePricing_tenantId_idx" ON "ServicePricing"("tenantId");
CREATE UNIQUE INDEX "ServicePricing_tenantId_name_key" ON "ServicePricing"("tenantId", "name");

CREATE INDEX "Staff_tenantId_idx" ON "Staff"("tenantId");
CREATE INDEX "Staff_tenantId_role_idx" ON "Staff"("tenantId", "role");
CREATE INDEX "Staff_tenantId_isActive_idx" ON "Staff"("tenantId", "isActive");
CREATE UNIQUE INDEX "Staff_tenantId_employeeId_key" ON "Staff"("tenantId", "employeeId");
CREATE UNIQUE INDEX "Staff_tenantId_username_key" ON "Staff"("tenantId", "username");
CREATE UNIQUE INDEX "Staff_tenantId_email_key" ON "Staff"("tenantId", "email");

CREATE INDEX "StaffClinic_tenantId_idx" ON "StaffClinic"("tenantId");
CREATE INDEX "StaffWard_tenantId_idx" ON "StaffWard"("tenantId");

CREATE INDEX "VitalSign_tenantId_idx" ON "VitalSign"("tenantId");
CREATE INDEX "VitalSign_tenantId_patientId_idx" ON "VitalSign"("tenantId", "patientId");

CREATE INDEX "WalletTransaction_tenantId_idx" ON "WalletTransaction"("tenantId");
CREATE UNIQUE INDEX "WalletTransaction_tenantId_reference_key" ON "WalletTransaction"("tenantId", "reference");
CREATE UNIQUE INDEX "WalletTransaction_tenantId_paymentReference_key" ON "WalletTransaction"("tenantId", "paymentReference");

CREATE INDEX "Ward_tenantId_idx" ON "Ward"("tenantId");
CREATE UNIQUE INDEX "Ward_tenantId_name_key" ON "Ward"("tenantId", "name");

CREATE INDEX "attendance_tenantId_idx" ON "attendance"("tenantId");
CREATE INDEX "dental_records_tenantId_idx" ON "dental_records"("tenantId");
CREATE INDEX "immunizations_tenantId_idx" ON "immunizations"("tenantId");

CREATE INDEX "leave_notifications_tenantId_idx" ON "leave_notifications"("tenantId");
CREATE INDEX "leave_policies_tenantId_idx" ON "leave_policies"("tenantId");
CREATE UNIQUE INDEX "leave_policies_tenantId_name_key" ON "leave_policies"("tenantId", "name");

CREATE INDEX "leave_requests_tenantId_idx" ON "leave_requests"("tenantId");
CREATE INDEX "leave_usages_tenantId_idx" ON "leave_usages"("tenantId");
CREATE INDEX "optometry_records_tenantId_idx" ON "optometry_records"("tenantId");
CREATE INDEX "patient_notifications_tenantId_idx" ON "patient_notifications"("tenantId");
CREATE INDEX "performance_reviews_tenantId_idx" ON "performance_reviews"("tenantId");

CREATE INDEX "staff_leave_entitlements_tenantId_idx" ON "staff_leave_entitlements"("tenantId");
CREATE UNIQUE INDEX "staff_leave_entitlements_tenantId_staff_id_year_key" ON "staff_leave_entitlements"("tenantId", "staff_id", "year");

CREATE INDEX "staff_trainings_tenantId_idx" ON "staff_trainings"("tenantId");
CREATE INDEX "trainings_tenantId_idx" ON "trainings"("tenantId");

-- ============================================================
-- STEP 6: Add foreign key constraints to Hospital
-- ============================================================

ALTER TABLE "HospitalSettings" ADD CONSTRAINT "HospitalSettings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceConfiguration" ADD CONSTRAINT "ServiceConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AntenatalVisit" ADD CONSTRAINT "AntenatalVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImagingOrder" ADD CONSTRAINT "ImagingOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImagingResult" ADD CONSTRAINT "ImagingResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KioskSession" ADD CONSTRAINT "KioskSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationTransaction" ADD CONSTRAINT "MedicationTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NHISAuthorization" ADD CONSTRAINT "NHISAuthorization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NHISClaim" ADD CONSTRAINT "NHISClaim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NHISDrugFormulary" ADD CONSTRAINT "NHISDrugFormulary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NHISDrugPrice" ADD CONSTRAINT "NHISDrugPrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartialPayment" ADD CONSTRAINT "PartialPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientHistoryRecord" ADD CONSTRAINT "PatientHistoryRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientJourney" ADD CONSTRAINT "PatientJourney_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientMessage" ADD CONSTRAINT "PatientMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientQueue" ADD CONSTRAINT "PatientQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientWallet" ADD CONSTRAINT "PatientWallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyBranch" ADD CONSTRAINT "PharmacyBranch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyStaff" ADD CONSTRAINT "PharmacyStaff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyTransaction" ADD CONSTRAINT "PharmacyTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ROIRequest" ADD CONSTRAINT "ROIRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePrice" ADD CONSTRAINT "ServicePrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePricing" ADD CONSTRAINT "ServicePricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffClinic" ADD CONSTRAINT "StaffClinic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffWard" ADD CONSTRAINT "StaffWard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dental_records" ADD CONSTRAINT "dental_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_notifications" ADD CONSTRAINT "leave_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_usages" ADD CONSTRAINT "leave_usages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "optometry_records" ADD CONSTRAINT "optometry_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_leave_entitlements" ADD CONSTRAINT "staff_leave_entitlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_trainings" ADD CONSTRAINT "staff_trainings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- STEP 7: Remove DEFAULT from tenantId columns
-- Future rows must explicitly specify their tenant
-- ============================================================

ALTER TABLE "Admission" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "AntenatalVisit" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Appointment" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "AppointmentReminder" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "BillingRecord" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Clinic" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ClinicalNote" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Delivery" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Department" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ImagingOrder" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ImagingResult" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "KioskSession" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "LabOrder" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Medication" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "MedicationTransaction" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "NHISAuthorization" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "NHISClaim" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "NHISDrugFormulary" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "NHISDrugPrice" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PartialPayment" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Patient" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PatientHistoryRecord" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PatientJourney" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PatientMessage" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PatientQueue" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PatientTransfer" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PatientWallet" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PaymentPlan" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PharmacyBranch" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PharmacyStaff" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "PharmacyTransaction" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Pregnancy" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Prescription" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ROIRequest" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "RolePermission" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ServiceConfiguration" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ServicePrice" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "ServicePricing" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Staff" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "StaffClinic" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "StaffWard" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "VitalSign" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "WalletTransaction" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "Ward" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "attendance" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "dental_records" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "immunizations" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "leave_notifications" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "leave_policies" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "leave_requests" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "leave_usages" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "optometry_records" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "patient_notifications" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "performance_reviews" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "staff_leave_entitlements" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "staff_trainings" ALTER COLUMN "tenantId" DROP DEFAULT;
ALTER TABLE "trainings" ALTER COLUMN "tenantId" DROP DEFAULT;