-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "corporateCompany" TEXT,
ADD COLUMN     "insuranceId" TEXT,
ADD COLUMN     "insuranceProvider" TEXT,
ADD COLUMN     "patientCategory" TEXT NOT NULL DEFAULT 'FPP';
