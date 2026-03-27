import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Message } from './models/models';

export class MessageService {
  constructor(
    private pool: Pool,
    private redisPublish: Redis,
  ) {}

  async handleIncoming(parsedMessage: Message) {
    // 3. Process message from userA to userB. Save to postgres and then publish to Redis
    const { conversation_id, from_user_id, body } = parsedMessage;
    const seq = await this.redisPublish.incr(`conversation:${conversation_id}:seq`);
    const created_at = new Date();
    await this.pool.query(
      'INSERT INTO messages (conversation_id, from_user_id, seq, body, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [conversation_id, from_user_id, seq, body, created_at],
    );
    const recipientUserIdResult = await this.pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND NOT user_id = $2',
      [conversation_id, from_user_id],
    );
    const recipientUserId: string = recipientUserIdResult.rows[0]?.user_id;
    if (!recipientUserId) {
      console.error(
        `No conversation_id found with ${conversation_id} and not user_id ${from_user_id}`,
      );
      return;
    }
    this.redisPublish.publish(
      `user:${recipientUserId}`,
      JSON.stringify({ ...parsedMessage, created_at, seq }),
    );
  }
}
