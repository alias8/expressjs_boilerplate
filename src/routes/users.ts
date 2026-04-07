import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { Prisma, UserType } from '../generated/prisma/client';
import {
  createUser,
  getUserByUserId,
  getUserByUsername,
  searchUsersByUsername,
} from '../utils/db/user';
import jwt from 'jsonwebtoken';

const router = Router();

interface UserLoginRequest {
  username: string;
  password: string;
  user_type: UserType;
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
  const { username, password, user_type } = req.body as UserLoginRequest;
  try {
    const password_hash = await bcrypt.hash(password, bcryptSaltRounds);
    const user = await createUser(username, password_hash, user_type);
    res.json({ user });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as UserLoginRequest;
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { userId: user.user_id, userType: user.user_type },
      process.env.JWT_SECRET!,
      {
        expiresIn: '24h',
      },
    );
    res.json({ token });

    return res.status(200).json({ username: user.username, id: user.user_id });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
