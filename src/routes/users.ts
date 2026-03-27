import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import * as bcrypt from 'bcryptjs';
import { User } from '../models/models';

const router = Router();

interface UserLoginRequest {
  username: string;
  password: string;
}

const bcryptSaltRounds = 10;
/*
* For development
* {
    "username": "user1",
    "password": "password1"
}
* */
router.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body as UserLoginRequest;
  try {
    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, created_at) VALUES ($1, $2, $3) RETURNING id, username, created_at',
      [username, passwordHash, new Date()],
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

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as UserLoginRequest;
  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username],
    );
    const user: User = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.status(200).json({ username: username, id: user.id });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
