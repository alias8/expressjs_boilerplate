/*
  Warnings:

  - The primary key for the `ConversationMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[conversation_id,user_id,joined_seq]` on the table `ConversationMember` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `ConversationMember` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `joined_seq` to the `ConversationMember` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ConversationMember" DROP CONSTRAINT "ConversationMember_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "joined_seq" BIGINT NOT NULL,
ADD COLUMN     "left_seq" BIGINT,
ADD CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversation_id_user_id_joined_seq_key" ON "ConversationMember"("conversation_id", "user_id", "joined_seq");
