-- AlterTable
ALTER TABLE "MedicationTransaction" ADD COLUMN     "patientId" TEXT;

-- AddForeignKey
ALTER TABLE "MedicationTransaction" ADD CONSTRAINT "MedicationTransaction_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
