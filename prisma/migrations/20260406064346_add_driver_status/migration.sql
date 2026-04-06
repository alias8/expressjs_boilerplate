/*
  Warnings:

  - You are about to drop the column `looking_for_trip` on the `Driver` table. All the data in the column will be lost.
  - Added the required column `driver_status` to the `Driver` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('DRIVING_SOMEONE', 'AVAILABLE_FOR_TRIPS', 'ON_BREAK', 'NOT_WORKING');

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "looking_for_trip",
ADD COLUMN     "driver_status" "DriverStatus" NOT NULL;
