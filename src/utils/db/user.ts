import { prisma } from '../../db/prisma';
import { Request, Response } from 'express';
import { DriverStatus, TripStatus, UserType } from '../../generated/prisma/enums';
import { asUserId } from '../../types/user';

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

export const createUser = async (username: string, password_hash: string, user_type: UserType) => {
  return prisma.user.create({
    data: { username, password_hash, user_type },
    select: { user_id: true, username: true, created_at: true },
  });
};

export async function riderCanRequest(userId: string, res: Response) {
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

export async function userIsDriver(userId: string, res: Response) {
  const driver = await prisma.driver.findFirst({
    where: {
      user_id: userId,
      driver_status: DriverStatus.AVAILABLE_FOR_TRIPS,
    },
  });
  if (!driver) {
    res.status(400).json({
      error:
        'User is either: 1. not a driver or 2. a driver, but not in the AVAILABLE_FOR_TRIPS status',
    });
    return { isDriver: false, driverId: '' };
  }
  return { isDriver: true, driverId: driver.driver_id };
}

export function getJwtToken(req: Request, res: Response) {
  const { jwtToken } = req;
  const userId = jwtToken?.userId;
  const userType = jwtToken?.userType;
  if (!userId || !userType) {
    res.status(404).json({ error: 'UserId or userType missing in token' });
    return false;
  }
  return { userId, userType: asUserId(userType) };
}
