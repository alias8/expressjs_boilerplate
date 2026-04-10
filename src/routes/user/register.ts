import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '../../generated/prisma/client';
import { createUser } from '../../utils/db/user';

const router = Router();

interface UserRegisterRequest {
  username: string;
  password: string;
}

const bcryptSaltRounds = 10;

router.post('/', async (req: Request, res: Response) => {
  const { username, password } = req.body as UserRegisterRequest;
  try {
    const password_hash = await bcrypt.hash(password, bcryptSaltRounds);
    const user = await createUser(username, password_hash);
    res.json({ user });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
