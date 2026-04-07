import { Router, Request, Response } from 'express';
import { getUserByUserId, searchUsersByUsername } from '../../utils/db/user';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await getUserByUserId(req.params.id as string);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await searchUsersByUsername(req.query.username as string);
    return res.status(200).json({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
