import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

interface ConversationCreateRequest {
  userIds: string[];
}

router.post('/', async (req: Request, res: Response) => {
  const { userIds } = req.body as ConversationCreateRequest;

  const foundUsers = await prisma.user.findMany({ where: { id: { in: userIds } } });
  if (foundUsers.length !== userIds.length) {
    res.status(404).json({ error: 'One or more users not found' });
    return;
  }

  // Find a conversation that has all users as members
  const existingConvo = await prisma.conversation.findFirst({
    where: {
      AND: [
        // All requested users are present
        ...userIds.map((id) => ({ conversationMember: { some: { user_id: id } } })),
        // No extra users are present
        { conversationMember: { every: { user_id: { in: userIds } } } },
      ],
    },
  });
  if (existingConvo) {
    return res.status(200).json({ conversationId: existingConvo.id });
  }

  try {
    const conversation = await prisma.$transaction(async (tx) => {
      const convo = await tx.conversation.create({ data: {} });
      for (const userId of userIds) {
        await tx.conversationMember.create({
          data: { conversation_id: convo.id, user_id: userId },
        });
      }
      return convo;
    });
    return res.status(200).json({ conversationId: conversation.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create conversation: ${message}` });
  }
});

// Get messages
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const before =
      Number(Array.isArray(req.query.before) ? req.query.before[0] : req.query.before) || 0;
    const since =
      Number(Array.isArray(req.query.since) ? req.query.since[0] : req.query.since) || 0;
    let messages;
    if (req.query.before !== undefined) {
      // up to 100 before that seq (scroll-back pagination)
      messages = await prisma.message.findMany({
        where: {
          conversation_id: req.params.id as string,
          seq: { lt: BigInt(before) },
        },
        orderBy: { seq: 'desc' },
        take: 100,
      });
    } else if (req.query.since !== undefined) {
      // up to 100 after that seq, ordered by most recent if >100 (reconnect catch-up)
      messages = await prisma.message.findMany({
        where: {
          conversation_id: req.params.id as string,
          seq: { gt: BigInt(since) },
        },
        orderBy: { seq: 'desc' },
        take: 101,
      });
    } else {
      // latest 100, no params (initial load)
      messages = await prisma.message.findMany({
        where: {
          conversation_id: req.params.id as string,
        },
        orderBy: { seq: 'desc' },
        take: 100,
      });
    }
    const hasMore = messages.length === 101;
    if (hasMore) messages.pop(); // reduce to 100 messages returned
    messages.reverse();
    return res.status(200).json({
      messages: messages.map((m) => ({ ...m, seq: m.seq.toString() })),
      ...(hasMore && { hasMore: true }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
