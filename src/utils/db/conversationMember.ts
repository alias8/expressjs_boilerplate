import { prisma } from '../../db/prisma';
import { CustomHttpError } from '../serverUtils';
import { getConversationByConversationId } from './conversation';

const LARGE_CONVO_MINIMUM_MEMBERS = 100;

export const getConversationsIdsForUser = async (userId: string) => {
  const memberships = await prisma.conversationMember.findMany({
    where: { user_id: userId },
    select: { conversation_id: true },
  });
  return memberships.map((m) => m.conversation_id);
};

export const isConversationLarge = async (conversationId: string) => {
  const largeConvoCheck = await prisma.conversationMember.findMany({
    where: {
      conversation_id: conversationId,
    },
    take: LARGE_CONVO_MINIMUM_MEMBERS + 1,
  });
  return largeConvoCheck.length > LARGE_CONVO_MINIMUM_MEMBERS;
};

export const addUsersToConvo = async (userIds: string[], conversationId: string) => {
  const existingConvo = await getConversationByConversationId(conversationId);
  if (!existingConvo) {
    throw new CustomHttpError(404, `conversationid ${conversationId} not found`);
  }
  return prisma.$transaction(async (tx) => {
    for (const userId of userIds) {
      const alreadyInConversation = await tx.conversationMember.findFirst({
        where: {
          AND: [{ conversation_id: conversationId }, { user_id: userId }, { left_seq: null }],
        },
      });
      if (!alreadyInConversation) {
        const joined_seq = await tx.message.findFirst({
          where: {
            conversation_id: conversationId,
          },
          orderBy: { seq: 'desc' },
        });
        await tx.conversationMember.create({
          data: {
            conversation_id: existingConvo.id,
            user_id: userId,
            joined_seq: joined_seq?.seq ?? BigInt(0),
          },
        });
      }
    }
  });
};
