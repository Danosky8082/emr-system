/*
  Warnings:

  - You are about to drop the column `babyApgar` on the `Delivery` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Delivery" DROP COLUMN "babyApgar",
ADD COLUMN     "babyApgar10min" INTEGER,
ADD COLUMN     "babyApgar1min" INTEGER,
ADD COLUMN     "babyApgar5min" INTEGER,
ADD COLUMN     "babyHeadCircumference" DOUBLE PRECISION,
ADD COLUMN     "babyLength" DOUBLE PRECISION,
ADD COLUMN     "babyNotes" TEXT,
ADD COLUMN     "complications" TEXT,
ADD COLUMN     "estimatedBloodLoss" DOUBLE PRECISION,
ADD COLUMN     "maternalCondition" TEXT,
ADD COLUMN     "perinealCondition" TEXT,
ADD COLUMN     "placentaDelivery" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "autoArchiveAt" TIMESTAMP(3),
ADD COLUMN     "dischargeNotes" TEXT,
ADD COLUMN     "dischargeType" TEXT,
ADD COLUMN     "dischargedAt" TIMESTAMP(3),
ADD COLUMN     "dischargedBy" TEXT,
ADD COLUMN     "fileStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "isDischarged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pregnancy" ADD COLUMN     "contractions" TEXT,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "dilation" DOUBLE PRECISION,
ADD COLUMN     "effacement" DOUBLE PRECISION,
ADD COLUMN     "laborNotes" TEXT,
ADD COLUMN     "laborStartTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" TEXT,
    "location" TEXT,
    "costCenter" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_managerId_key" ON "Department"("managerId");

-- RenameForeignKey
ALTER TABLE "Staff" RENAME CONSTRAINT "Staff_manager_id_fkey" TO "Staff_manager_id_fkey_self";

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
