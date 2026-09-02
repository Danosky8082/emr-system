-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "dental" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "immunizations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "laborAndDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optometry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "patientPortal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portalSetup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "radiology" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "dashboard" SET DEFAULT false;
