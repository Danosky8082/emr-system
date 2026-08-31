-- AlterTable
ALTER TABLE "PatientJourney" ADD COLUMN     "cardFeeBilled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardFeeRecordId" TEXT,
ADD COLUMN     "consultationFeeBilled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consultationFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consultationFeeRecordId" TEXT,
ADD COLUMN     "registrationFeeBilled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationFeeRecordId" TEXT;

-- CreateTable
CREATE TABLE "ServiceConfiguration" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConfiguration_serviceType_key" ON "ServiceConfiguration"("serviceType");
