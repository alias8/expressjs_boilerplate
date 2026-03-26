import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import bcrypt from 'bcrypt';

const router = Router();

interface UserLoginRequest {
  username: string;
  password: string;
}

const bcryptSaltRounds = 10;

router.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body as UserLoginRequest;
  try {
    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash],
    );
    const user = result.rows[0]; // the inserted row
    res.json({ user });
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (e instanceof Error && (e as any).code === '23505') {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// router.post('/login', (req: Request, res: Response) => {
//   const { username, password } = req.body;
//   res.json({ message: 'users route' });
// });

export default router;
