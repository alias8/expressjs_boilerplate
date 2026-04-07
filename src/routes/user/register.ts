import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { Prisma, UserType } from '../../generated/prisma/client';
import { createUser } from '../../utils/db/user';

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
router.post('/', async (req: Request, res: Response) => {
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

export default router;
