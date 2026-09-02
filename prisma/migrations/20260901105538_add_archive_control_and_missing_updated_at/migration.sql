/*
  Warnings:

  - Added the required column `updatedAt` to the `MedicationTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PharmacyTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MedicationTransaction" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "accessCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "activationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "archiveScheduledAt" TIMESTAMP(3),
ADD COLUMN     "isActiveForModule" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PatientJourney" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedBy" TEXT,
ADD COLUMN     "activationRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PharmacyTransaction" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
