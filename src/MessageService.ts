import { Redis } from 'ioredis';
import { PrismaClient } from './generated/prisma/client';

export class MessageService {
  constructor(
    private prisma: PrismaClient,
    private redisPublish: Redis,
  ) {}

  async handleIncoming(parsedMessage: {
    conversation_id: string;
    from_user_id: string;
    body: string;
  }) {
    const { conversation_id, from_user_id, body } = parsedMessage;
    const seq = await this.redisPublish.incr(`conversation:${conversation_id}:seq`);
    const created_at = new Date();

    await this.prisma.message.create({
      data: {
        conversation_id,
        from_user_id,
        body,
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
