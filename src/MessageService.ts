import { Redis } from 'ioredis';
import { MessageType, PrismaClient } from './generated/prisma/client';
import { ESMessage, Message } from './models/models';
import { Client } from '@elastic/elasticsearch';

export class MessageService {
  constructor(
    private prisma: PrismaClient,
    private redisPublish: Redis,
    private elasticSearchClient: Client,
  ) {}

  async handleIncoming(parsedMessage: Message) {
    const { conversation_id, from_user_id, body, type, metadata } = parsedMessage;
    const seq = await this.redisPublish.incr(`conversation:${conversation_id}:seq`);
    const message = await this.prisma.message.create({
      data: {
        conversation_id,
        from_user_id,
        body,
        type,
        metadata,
        seq: BigInt(seq),
      },
    });

    this.elasticSearchClient
      .index<ESMessage>({
        index: 'messages',
        id: message.id,
        document: {
          conversation_id,
          from_user_id,
          body,
          type,
          metadata,
          seq,
          created_at: message.created_at,
        },
      })
      .catch((err) => {
        console.error('Failed to index message in Elasticsearch:', err);
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
    if (recipients.length < 100) {
      recipients.forEach((recipient) => {
        this.redisPublish.publish(
          `user:${recipient.user_id}`,
          JSON.stringify({ ...parsedMessage, created_at: message.created_at, seq }),
        );
      });
    } else {
      // If was large convo:
      this.redisPublish.publish(
        `conversation:${conversation_id}`,
        JSON.stringify({ newMessage: true }),
      );
      // Then on the client's side, they would be subscribed to large channels. They would get the message
      // that there are more messages on the large channel. When they open that channel, the messages are fetched
      // otherwise, just show an "unread" lozenge next to the channel
    }
  }
}
