-- CreateTable
CREATE TABLE "StaffClinic" (
    "staffId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,

    CONSTRAINT "StaffClinic_pkey" PRIMARY KEY ("staffId","clinicId")
);

-- CreateTable
CREATE TABLE "StaffWard" (
    "staffId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,

    CONSTRAINT "StaffWard_pkey" PRIMARY KEY ("staffId","wardId")
);

-- AddForeignKey
ALTER TABLE "StaffClinic" ADD CONSTRAINT "StaffClinic_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffClinic" ADD CONSTRAINT "StaffClinic_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWard" ADD CONSTRAINT "StaffWard_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWard" ADD CONSTRAINT "StaffWard_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
