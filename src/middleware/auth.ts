import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JwtUberToken } from '../types/express';

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
  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    if (typeof user != 'string' && user !== undefined) {
      req.user = user as JwtUberToken; // Attach decoded payload to request
      next(); // Proceed to the next middleware or route handler
    } else {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
  });
};
