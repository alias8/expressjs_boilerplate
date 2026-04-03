import { Redis } from 'ioredis';
import { PrismaClient } from './generated/prisma/client';
import { Message } from './models/models';

export class MessageService {
  constructor(
    private prisma: PrismaClient,
    private redisPublish: Redis,
  ) {}

  async handleIncoming(parsedMessage: Message) {
    const { conversation_id, from_user_id, body, type, metadata } = parsedMessage;
    const seq = await this.redisPublish.incr(`conversation:${conversation_id}:seq`);
    const created_at = new Date();

    await this.prisma.message.create({
      data: {
        conversation_id,
        from_user_id,
        body,
        type,
        metadata,
        seq: BigInt(seq),
      },
    });

    const recipients = await this.prisma.conversationMember.findMany({
      where: {
        conversation_id,
        NOT: { user_id: from_user_id },
      },
    });

    if (recipients.length === 0) {
      console.error(
        `No recipients found for conversation ${conversation_id} excluding user ${from_user_id}`,
      );
      return;
    }

    recipients.forEach((recipient) => {
      this.redisPublish.publish(
        `user:${recipient.user_id}`,
        JSON.stringify({ ...parsedMessage, created_at, seq }),
      );
    });
  }
}
