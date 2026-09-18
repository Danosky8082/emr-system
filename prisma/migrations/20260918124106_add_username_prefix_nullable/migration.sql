/*
  Warnings:

  - A unique constraint covering the columns `[usernamePrefix]` on the table `Hospital` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "usernamePrefix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_usernamePrefix_key" ON "Hospital"("usernamePrefix");
