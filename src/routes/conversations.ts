import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

interface ConversationCreateRequest {
  user1Id: string;
  user2Id: string;
}

router.post('/', async (req: Request, res: Response) => {
  const { user1Id, user2Id } = req.body as ConversationCreateRequest;

  const user1 = await prisma.user.findUnique({ where: { id: user1Id } });
  if (!user1) {
    res.status(404).json({ error: `Userid ${user1Id} not found` });
    return;
  }
  const user2 = await prisma.user.findUnique({ where: { id: user2Id } });
  if (!user2) {
    res.status(404).json({ error: `Userid ${user2Id} not found` });
    return;
  }

  // Find a conversation that has both users as members
  const existingConvo = await prisma.conversation.findFirst({
    where: {
      AND: [
        { conversationMember: { some: { user_id: user1Id } } },
        { conversationMember: { some: { user_id: user2Id } } },
      ],
    },
  });
  if (existingConvo) {
    return res.status(200).json({ conversationId: existingConvo.id });
  }

  try {
    const conversation = await prisma.$transaction(async (tx) => {
      const convo = await tx.conversation.create({ data: {} });
      await tx.conversationMember.create({
        data: { conversation_id: convo.id, user_id: user1Id },
      });
      await tx.conversationMember.create({
        data: { conversation_id: convo.id, user_id: user2Id },
      });
      return convo;
    });
    return res.status(200).json({ conversationId: conversation.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create conversation: ${message}` });
  }
});

router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const after =
      Number(Array.isArray(req.query.after) ? req.query.after[0] : req.query.after) || 0;
    const messages = await prisma.message.findMany({
      where: {
        conversation_id: req.params.id as string,
        seq: { gt: BigInt(after) },
      },
      orderBy: { seq: 'asc' },
    });
    return res.status(200).json({
      messages: messages.map((m) => ({ ...m, seq: m.seq.toString() })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
