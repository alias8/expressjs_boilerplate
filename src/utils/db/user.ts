import { prisma } from '../../db/prisma';
import { Request, Response } from 'express';
import { DriverStatus, TripStatus } from '../../generated/prisma/enums';

export const searchUsersByUsername = async (username: string) => {
  return prisma.user.findMany({
    where: { username: { contains: username } },
    select: { user_id: true, username: true },
  });
};

export const getUserByUsername = async (username: string) => {
  return prisma.user.findUnique({
    where: { username },
  });
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

export async function userIdValid(req: Request, res: Response) {
  const userId = req.query.userId as string; // would come from jwt in real life

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return false;
  }
  const userExists = await prisma.user.findFirst({
    where: { user_id: userId },
  });
  if (!userExists) {
    res.status(400).json({ error: 'userId not found' });
    return false;
  }
  return true;
}

export async function riderCanRequest(req: Request, res: Response) {
  const userId = req.query.userId as string; // would come from jwt in real life

  const isActiveDriver = await prisma.driver.findFirst({
    where: {
      user_id: userId,
      driver_status: { not: DriverStatus.OFF_DUTY },
    },
  });
  if (isActiveDriver?.driver_id) {
    res.status(400).json({ error: 'Cannot request a ride while on duty as a driver' });
    return false;
  }

  const onTripAlready = await prisma.trip.findFirst({
    where: {
      rider_id: userId,
      status: {
        in: [TripStatus.REQUESTED, TripStatus.ACCEPTED, TripStatus.IN_PROGRESS],
      },
    },
  });
  if (onTripAlready) {
    res.status(400).json({ error: 'Cannot request a ride while already on a trip' });
    return false;
  }
  return true;
}

export async function userIsDriver(req: Request, res: Response) {
  const userId = req.query.userId as string; // would come from jwt in real life
  const driver = await prisma.driver.findFirst({
    where: {
      user_id: userId,
      driver_status: DriverStatus.AVAILABLE_FOR_TRIPS,
    },
  });
  if (!driver) {
    res
      .status(400)
      .json({
        error:
          'User is either: 1. not a driver or 2. a driver, but not in the AVAILABLE_FOR_TRIPS status',
      });
    return { isDriver: false, driverId: '' };
  }
  return { isDriver: true, driverId: driver.driver_id };
}
