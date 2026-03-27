import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { ConnectionManager } from './ConnectionManager';
import { Message } from './models/models';

export class MessageService {
  constructor(
    private pool: Pool,
    private redis: Redis,
    private connectionManager: ConnectionManager,
  ) {}

  async handleIncoming(parsedMessage: Message) {
    // userA sends message to userB
    const { conversation_id, from_user_id, body } = parsedMessage;
    const seq = await this.redis.incr(`conversation:${conversation_id}:seq`);
    // Save message in postgres
    await this.pool.query(
      'INSERT INTO messages (conversation_id, from_user_id, seq, body, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [conversation_id, from_user_id, seq, body, new Date()],
    );
    // query postgres to find relevant conversation
    const idToSendToResult = await this.pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND NOT user_id = $2',
      [conversation_id, from_user_id],
    );
    const recipientUserId: string = idToSendToResult.rows[0]?.user_id;
    if (!recipientUserId) {
      console.error(
        `No conversation_id found with ${conversation_id} and not user_id ${from_user_id}`,
      );
      return;
    }
    const recipientSocket = this.connectionManager.getSocket(recipientUserId);
    if (!recipientSocket) {
      // user is offline — that's fine, message is already saved to Postgres
      return;
    }
    recipientSocket.send(JSON.stringify({ ...parsedMessage, seq }));
  }
}
