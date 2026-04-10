import { prisma } from '../../db/prisma';
import { Request, Response } from 'express';

export const searchUsersByUsername = async (username: string) => {
  return prisma.user.findMany({
    where: { username: { contains: username } },
    select: { user_id: true, username: true },
  });
};

export const getUserByUsername = async (username: string) => {
  return prisma.user.findUnique({ where: { username } });
};

export const getUserByUserId = async (userId: string) => {
  return prisma.user.findUnique({
    where: { user_id: userId },
    select: { user_id: true, username: true },
  });
};

export const createUser = async (username: string, password_hash: string) => {
  return prisma.user.create({
    data: { username, password_hash },
    select: { user_id: true, username: true, created_at: true },
  });
};

export function getJwtToken(req: Request, res: Response) {
  const userId = req.jwtToken?.userId;
  if (!userId) {
    res.status(401).json({ error: 'userId missing in token' });
    return false;
  }
  return { userId };
}
