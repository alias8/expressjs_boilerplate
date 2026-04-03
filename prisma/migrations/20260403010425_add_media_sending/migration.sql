/*
  Warnings:

  - Added the required column `type` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image');

-- AlterTable
ALTER TABLE "Message"
    ADD COLUMN "metadata" JSONB,
    ADD COLUMN "type"     "MessageType" NOT NULL,
    ALTER COLUMN "body" DROP NOT NULL;

-- Enforce: text messages must have a body
ALTER TABLE "Message"
    ADD CONSTRAINT "message_text_requires_body"
        CHECK (type != 'text' OR body IS NOT NULL);
