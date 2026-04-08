import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { JwtUberToken } from '../types/express';
import { WebSocket } from 'ws';
import http from 'http';
import { UserType } from '../generated/prisma/enums';
import { URL } from 'node:url';

const PUBLIC_ROUTES = [
  { path: '/users/login', method: 'POST' },
  { path: '/users/register', method: 'POST' },
];

export const authenticateJwtToken = (req: Request, res: Response, next: NextFunction) => {
  const isPublic = PUBLIC_ROUTES.some((r) => r.path === req.path && r.method === req.method);
  if (isPublic) return next();
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
  if (!token) return res.status(401).json({ message: 'Access denied: No token provided' });

  try {
    const decodedJwtToken = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof decodedJwtToken != 'string' && decodedJwtToken !== undefined) {
      req.jwtToken = decodedJwtToken as JwtUberToken; // Attach decoded payload to request
      next(); // Proceed to the next middleware or route handler
    } else {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export function getUserIdFromWebsocket(
  ws: WebSocket,
  req: http.IncomingMessage,
): false | { userId: string; userType: UserType } {
  const { url } = req;
  if (!url) {
    console.error(`No url in websocket req, closing connection`);
    ws.close();
    return false;
  }
  const myUrl = new URL(url, 'http://localhost:3000');
  const params = myUrl.searchParams;
  const jwtToken = params.get('token');
  if (!jwtToken) {
    console.error(`Jwt token not present in url`);
    return false;
  }

  try {
    const decodedToken = jwt.verify(jwtToken, process.env.JWT_SECRET!);
    if (typeof decodedToken != 'string' && decodedToken !== undefined) {
      const { userId, userType } = decodedToken as JwtUberToken;
      if (userType !== UserType.DRIVER && userType !== UserType.RIDER) {
        console.error(`userType in jwt must be ${UserType.DRIVER} or ${UserType.RIDER}`);
        return false;
      }
      return { userId, userType: userType as UserType };
    }
    return false;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error(`Error during websocket connection ${message}`);
    return false;
  }
}
