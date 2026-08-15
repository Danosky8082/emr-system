/*
  Warnings:

  - You are about to drop the column `sentToClinicAt` on the `PatientJourney` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PatientJourney" DROP CONSTRAINT "PatientJourney_clinicId_fkey";

-- AlterTable
ALTER TABLE "PatientJourney" DROP COLUMN "sentToClinicAt",
ADD COLUMN     "destinationType" TEXT NOT NULL DEFAULT 'CLINIC',
ADD COLUMN     "sentToDestinationAt" TIMESTAMP(3),
ADD COLUMN     "wardId" TEXT,
ALTER COLUMN "clinicId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PatientJourney" ADD CONSTRAINT "PatientJourney_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientJourney" ADD CONSTRAINT "PatientJourney_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
