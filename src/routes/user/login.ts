import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { UserType } from '../../generated/prisma/client';
import { getUserByUsername } from '../../utils/db/user';
import jwt from 'jsonwebtoken';
import { JwtUberToken } from '../../types/express';

const router = Router();

interface UserLoginRequest {
  username: string;
  password: string;
  user_type: UserType;
}

router.post('/', async (req: Request, res: Response) => {
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
    const payload: JwtUberToken = { userId: user.user_id, userType: user.user_type };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: '24h',
    });
    res.json({ token });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
