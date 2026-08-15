/*
  Warnings:

  - You are about to drop the column `billingId` on the `PatientJourney` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[billingRecordId]` on the table `PatientJourney` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PatientJourney" DROP COLUMN "billingId",
ADD COLUMN     "billingRecordId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PatientJourney_billingRecordId_key" ON "PatientJourney"("billingRecordId");

-- AddForeignKey
ALTER TABLE "PatientJourney" ADD CONSTRAINT "PatientJourney_billingRecordId_fkey" FOREIGN KEY ("billingRecordId") REFERENCES "BillingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
