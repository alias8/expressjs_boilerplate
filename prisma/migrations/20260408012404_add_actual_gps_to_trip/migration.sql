/*
  Warnings:

  - You are about to drop the column `endGPSLatitude` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `endGPSLongitude` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `startGPSLatitude` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `startGPSLongitude` on the `Trip` table. All the data in the column will be lost.
  - Added the required column `endGPSLatitude_requested` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endGPSLongitude_requested` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startGPSLatitude_requested` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startGPSLongitude_requested` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "endGPSLatitude",
DROP COLUMN "endGPSLongitude",
DROP COLUMN "startGPSLatitude",
DROP COLUMN "startGPSLongitude",
ADD COLUMN     "dropped_off_at" TIMESTAMP(3),
ADD COLUMN     "endGPSLatitude_actual" DECIMAL(9,6),
ADD COLUMN     "endGPSLatitude_requested" DECIMAL(9,6) NOT NULL,
ADD COLUMN     "endGPSLongitude_actual" DECIMAL(9,6),
ADD COLUMN     "endGPSLongitude_requested" DECIMAL(9,6) NOT NULL,
ADD COLUMN     "startGPSLatitude_actual" DECIMAL(9,6),
ADD COLUMN     "startGPSLatitude_requested" DECIMAL(9,6) NOT NULL,
ADD COLUMN     "startGPSLongitude_actual" DECIMAL(9,6),
ADD COLUMN     "startGPSLongitude_requested" DECIMAL(9,6) NOT NULL;
