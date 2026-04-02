import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client';

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
    const password_hash = await bcrypt.hash(password, bcryptSaltRounds);
    const user = await prisma.user.create({
      data: { username, password_hash },
      select: { id: true, username: true, created_at: true },
    });
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
    const user = await prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.status(200).json({ username: user.username, id: user.id });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { username: { contains: req.query.username as string } },
      select: { id: true, username: true },
    });
    return res.status(200).json({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
