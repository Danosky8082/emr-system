-- CreateTable
CREATE TABLE "ServicePricing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FPP',
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nhisPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "corporatePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServicePricing_name_key" ON "ServicePricing"("name");
