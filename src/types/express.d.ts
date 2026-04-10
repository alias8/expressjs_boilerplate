import { JwtPayload } from 'jsonwebtoken';

export interface JwtToken extends JwtPayload {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      jwtToken?: JwtToken;
    }
  }
}
