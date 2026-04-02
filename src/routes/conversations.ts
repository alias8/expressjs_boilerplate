import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

interface ConversationCreateRequest {
  userIds: string[];
}

// Get conversations for a user, when user logs in and sees the list of convos
router.get('/', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  try {
    const conversations = await prisma.conversation.findMany({
      where: { conversationMember: { some: { user_id: userId } } },
      include: {
        conversationMember: { include: { user: { select: { id: true, username: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        participants: c.conversationMember.map((m) => m.user),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

// Create convo
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
      const joined_seq = await tx.message.findFirst({
        where: {
          conversation_id: convo.id,
        },
        orderBy: { seq: 'desc' },
        take: 1,
      });
      for (const userId of userIds) {
        await tx.conversationMember.create({
          data: {
            conversation_id: convo.id,
            user_id: userId,
            joined_seq: joined_seq?.seq ?? BigInt(0),
          },
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

// Add 1 or more users to convo
router.post('/:conversationId/add/', async (req: Request, res: Response) => {
  const { userIds } = req.body as ConversationCreateRequest;
  const conversationId = req.params.conversationId as string;

  const foundUsers = await prisma.user.findMany({ where: { id: { in: userIds } } });
  if (foundUsers.length !== userIds.length) {
    res.status(404).json({ error: 'One or more users not found' });
    return;
  }

  // Find if convo exists
  const existingConvo = await prisma.conversation.findFirst({ where: { id: conversationId } });
  if (!existingConvo) {
    return res.status(404).json({ error: `conversationid ${conversationId} not found` });
  }

  try {
    await prisma.$transaction(async (tx) => {
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
            take: 1,
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
    return res.status(200).json({ conversationId: existingConvo.id });
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
