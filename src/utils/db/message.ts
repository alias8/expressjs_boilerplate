import { prisma } from '../../db/prisma';

export const getMessagesBeforeSeq = async (
  conversationId: string,
  before: number,
  joinedSequenceWhenUserJoinedConversation: bigint,
) => {
  // up to 100 before that seq (scroll-back pagination)
  return prisma.message.findMany({
    where: {
      conversation_id: conversationId,
      seq: { lt: BigInt(before), gt: joinedSequenceWhenUserJoinedConversation },
    },
    orderBy: { seq: 'desc' },
    take: 100,
  });
};

export const getMessagesAfterSeq = async (
  conversationId: string,
  since: number,
  joinedSequenceWhenUserJoinedConversation: bigint,
) => {
  // up to 100 after that seq, ordered by most recent if >100 (reconnect catch-up)
  const sinceSeq = BigInt(since);
  const maxSeq =
    sinceSeq > joinedSequenceWhenUserJoinedConversation
      ? sinceSeq
      : joinedSequenceWhenUserJoinedConversation;
  return prisma.message.findMany({
    where: {
      conversation_id: conversationId,
      seq: { gt: BigInt(maxSeq) },
    },
    orderBy: { seq: 'desc' },
    take: 101,
  });
};

export const getLatestMessages = async (conversationId: string, joinedSeq: bigint) => {
  // latest 100, no params (initial load)
  return prisma.message.findMany({
    where: {
      conversation_id: conversationId,
      seq: { gt: joinedSeq },
    },
    orderBy: { seq: 'desc' },
    take: 100,
  });
};
