/*
  Warnings:

  - The values [NOT_WORKING] on the enum `DriverStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DriverStatus_new" AS ENUM ('DRIVING_SOMEONE', 'AVAILABLE_FOR_TRIPS', 'ON_BREAK', 'OFF_DUTY');
ALTER TABLE "Driver" ALTER COLUMN "driver_status" TYPE "DriverStatus_new" USING ("driver_status"::text::"DriverStatus_new");
ALTER TYPE "DriverStatus" RENAME TO "DriverStatus_old";
ALTER TYPE "DriverStatus_new" RENAME TO "DriverStatus";
DROP TYPE "public"."DriverStatus_old";
COMMIT;
