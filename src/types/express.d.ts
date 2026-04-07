import { JwtPayload } from 'jsonwebtoken';
import { UserType } from '../generated/prisma/enums';

export interface JwtUberToken extends JwtPayload {
  userId: string;
  userType: UserType;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUberToken;
    }
  }
}
