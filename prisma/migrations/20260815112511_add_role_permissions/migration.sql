-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "dashboard" BOOLEAN NOT NULL DEFAULT true,
    "patients" BOOLEAN NOT NULL DEFAULT false,
    "staff" BOOLEAN NOT NULL DEFAULT false,
    "appointments" BOOLEAN NOT NULL DEFAULT false,
    "prescriptions" BOOLEAN NOT NULL DEFAULT false,
    "labOrders" BOOLEAN NOT NULL DEFAULT false,
    "billing" BOOLEAN NOT NULL DEFAULT false,
    "pharmacy" BOOLEAN NOT NULL DEFAULT false,
    "clinics" BOOLEAN NOT NULL DEFAULT false,
    "wards" BOOLEAN NOT NULL DEFAULT false,
    "pricing" BOOLEAN NOT NULL DEFAULT false,
    "billingOfficer" BOOLEAN NOT NULL DEFAULT false,
    "patientIntake" BOOLEAN NOT NULL DEFAULT false,
    "admissions" BOOLEAN NOT NULL DEFAULT false,
    "patientHistory" BOOLEAN NOT NULL DEFAULT false,
    "roiRequests" BOOLEAN NOT NULL DEFAULT false,
    "nurseDashboard" BOOLEAN NOT NULL DEFAULT false,
    "doctorDashboard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_key" ON "RolePermission"("role");
