import { Router, Request, Response } from 'express';
import { elasticSearchClient } from '../server';
import { getConversationsIdsForUser } from '../utils/db/conversationMember';

const router = Router();

// Search messages for text
router.get('/', async (req: Request, res: Response) => {
  const userId = req.query.userId as string; // todo: use JWT instead of passing id in the url
  const text = req.query.text as string;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  try {
    const userConversationIds = await getConversationsIdsForUser(userId);
    const result = await elasticSearchClient.search({
      index: 'messages',
      query: {
        bool: {
          must: { match: { body: text } },
          filter: { terms: { conversation_id: userConversationIds } },
        },
      },
    });
    res.status(200).json({ result: result.hits.hits });
    return;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
