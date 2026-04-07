/*
  Warnings:

  - Added the required column `user_type` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('RIDER', 'DRIVER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "user_type" "UserType" NOT NULL;
