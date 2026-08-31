-- DropForeignKey
ALTER TABLE "LabOrder" DROP CONSTRAINT "LabOrder_patientId_fkey";

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN     "validated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
