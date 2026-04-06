-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_driver_id_fkey";

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "Driver"("driver_id") ON DELETE SET NULL ON UPDATE CASCADE;
