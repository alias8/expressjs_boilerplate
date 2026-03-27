import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

const router = Router();

interface ConversationCreateRequest {
  user1Id: string;
  user2Id: string;
}

router.post('/', async (req: Request, res: Response) => {
  const { user1Id, user2Id } = req.body as ConversationCreateRequest;
  // Check users exist
  const user1 = await pool.query('SELECT id FROM users WHERE id = $1', [user1Id]);
  if (!user1.rows[0]) {
    res.status(404).json({ error: `Userid ${user1Id} not found` });
    return;
  }
  const user2 = await pool.query('SELECT id FROM users WHERE id = $1', [user2Id]);
  if (!user2.rows[0]) {
    res.status(404).json({ error: `Userid ${user2Id} not found` });
    return;
  }

  // Check if convo already exists
  const existingConvo = await pool.query(
    `SELECT conversation_id FROM conversation_members WHERE user_id = $1 
                    INTERSECT 
                    SELECT conversation_id FROM conversation_members WHERE user_id = $2`,
    [user1Id, user2Id],
  );
  if (existingConvo.rows[0]) {
    return res.status(200).json({ conversationId: existingConvo.rows[0].conversation_id });
  }

  const client = await pool.connect(); // grab a dedicated connection
  try {
    await client.query('BEGIN');
    // If no convo already, create conversation row in postgres
    const conversationSql = await client.query(
      'INSERT INTO conversations (created_at) VALUES ($1) RETURNING id',
      [new Date()],
    );
    const conversationId = conversationSql.rows[0]?.id; // the inserted row
    await client.query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)',
      [conversationId, user1Id],
    );
    await client.query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)',
      [conversationId, user2Id],
    );
    await client.query('COMMIT');
    return res.status(200).json({ conversationId: conversationId });
  } catch (e) {
    await client.query('ROLLBACK');
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create conversation: ${message}` });
  } finally {
    client.release(); // always return it to the pool
  }
});

export default router;
