import { prisma } from './db/prisma';

export const getConversationsIdsForUser = async (userId: string) => {
  const memberships = await prisma.conversationMember.findMany({
    where: { user_id: userId },
    select: { conversation_id: true },
  });
  return memberships.map((m) => m.conversation_id);
};
