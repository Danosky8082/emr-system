/*
  Warnings:

  - You are about to drop the column `amount` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceClaimId` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceProvider` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `remainingBalance` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `serviceDescription` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `serviceId` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `serviceType` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the `departments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[receiptNumber]` on the table `BillingRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `balance` to the `BillingRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `items` to the `BillingRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Staff" DROP CONSTRAINT "Staff_department_id_fkey";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_manager_id_fkey";

-- DropIndex
DROP INDEX "BillingRecord_walletTransactionId_key";

-- AlterTable
ALTER TABLE "BillingRecord" DROP COLUMN "amount",
DROP COLUMN "discount",
DROP COLUMN "insuranceClaimId",
DROP COLUMN "insuranceProvider",
DROP COLUMN "remainingBalance",
DROP COLUMN "serviceDescription",
DROP COLUMN "serviceId",
DROP COLUMN "serviceType",
DROP COLUMN "tax",
ADD COLUMN     "balance" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "items" JSONB NOT NULL,
ADD COLUMN     "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "receiptGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiptGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "receiptNumber" TEXT;

-- AlterTable
ALTER TABLE "ServiceConfiguration" ADD COLUMN     "corporateAmount" DOUBLE PRECISION,
ADD COLUMN     "nhisAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "department_id";

-- DropTable
DROP TABLE "departments";

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_receiptNumber_key" ON "BillingRecord"("receiptNumber");
