/*
  Warnings:

  - You are about to drop the column `timestamp` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `ClinicalNote` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Staff` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `BillingRecord` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeId]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `module` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staffId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `invoiceNumber` to the `BillingRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `BillingRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeId` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Staff` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Consultation',
ALTER COLUMN "status" SET DEFAULT 'Scheduled';

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "timestamp",
DROP COLUMN "userId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "module" TEXT NOT NULL,
ADD COLUMN     "staffId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BillingRecord" ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "insuranceClaimId" TEXT,
ADD COLUMN     "insuranceProvider" TEXT,
ADD COLUMN     "invoiceNumber" TEXT NOT NULL,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "ClinicalNote" DROP COLUMN "content",
ADD COLUMN     "assessment" TEXT,
ADD COLUMN     "fullContent" TEXT,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "subjective" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'SOAP';

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "emergencyContact" TEXT;

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "name",
ADD COLUMN     "department" TEXT,
ADD COLUMN     "employeeId" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastName" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "prescribingStaffId" TEXT NOT NULL,
    "dispensingStaffId" TEXT,
    "medication" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Prescribed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderingStaffId" TEXT NOT NULL,
    "labStaffId" TEXT,
    "testName" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Routine',
    "status" TEXT NOT NULL DEFAULT 'Ordered',
    "result" TEXT,
    "resultDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "category" TEXT NOT NULL,
    "supplier" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "stockQuantity" INTEGER NOT NULL,
    "reorderLevel" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "batchNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationTransaction" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_invoiceNumber_key" ON "BillingRecord"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_employeeId_key" ON "Staff"("employeeId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_prescribingStaffId_fkey" FOREIGN KEY ("prescribingStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_dispensingStaffId_fkey" FOREIGN KEY ("dispensingStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_orderingStaffId_fkey" FOREIGN KEY ("orderingStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_labStaffId_fkey" FOREIGN KEY ("labStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationTransaction" ADD CONSTRAINT "MedicationTransaction_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
