import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { TripStatus } from '../models/models';
import { redisPublish, redisSubscribe } from '../server';
import {
  REDIS_TRIP_KEY,
  REDIS_TRIPS_AVAILABLE_KEY,
  TRIP_ACCEPTED,
  TRIP_AVAILABLE,
  TRIP_UPDATED,
} from '../ConnectionManager';

const router = Router();

export const HARD_CODED_CITY = 'sydney';

interface TripRequest {
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
}

export interface TripAvailableMessage {
  type: typeof TRIP_AVAILABLE;
  tripId: string;
  startGPSLatitude: number;
  startGPSLongitude: number;
  endGPSLatitude: number;
  endGPSLongitude: number;
  requested_at: Date;
  requested_by: string;
}

export interface TripAcceptedMessage {
  type: typeof TRIP_ACCEPTED;
  requested_by: string;
  accepted_by: string;
  accepted_at: Date;
}

// Request a trip
router.post('/', async (req: Request, res: Response) => {
  const userId = req.query.userId as string; // would come from jwt in real life
  const { startGPSLatitude, startGPSLongitude, endGPSLatitude, endGPSLongitude } =
    req.body as TripRequest;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const userExists = await prisma.user.findFirst({
    where: { id: userId },
  });
  if (!userExists) {
    return res.status(400).json({ error: 'userId not found' });
  }
  const available = await prisma.rider.findFirst({
    where: { user_id: userId, on_trip: false },
  });
  if (!available) {
    return res.status(400).json({ error: 'userId is on trip already' });
  }
  try {
    const trip = await prisma.trip.create({
      data: {
        startGPSLatitude,
        startGPSLongitude,
        endGPSLatitude,
        endGPSLongitude,
        requested_at: new Date(),
        requested_by: userId,
        status: TripStatus.REQUESTED,
      },
    });
    // Publish to drivers listening for this
    redisPublish.publish(
      // we are just hardcoding to 1 city atm, but we want to be able to publish to the nearest big city
      REDIS_TRIPS_AVAILABLE_KEY,
      JSON.stringify({
        type: TRIP_AVAILABLE,
        tripId: trip.id,
        startGPSLatitude,
        startGPSLongitude,
        endGPSLatitude,
        endGPSLongitude,
        requested_at: new Date(),
        requested_by: userId,
      } as TripAvailableMessage),
    );
    redisSubscribe.subscribe(`${REDIS_TRIP_KEY}${trip.id}`); // Listen for updates on this trip
    return res.status(200).json({ trip: trip.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

// Accept a trip
router.put('/:tripId', async (req: Request, res: Response) => {
  const userId = req.query.userId as string; // would come from jwt in real life
  const tripId = req.params.tripId;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const userExists = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  if (!userExists) {
    return res.status(400).json({ error: 'userId not found' });
  }
  const available = await prisma.driver.findFirst({
    where: { user_id: userId, on_trip: false },
  });
  if (!available) {
    return res.status(400).json({ error: 'userId is on trip already' });
  }
  try {
    return prisma.$transaction(async (tx) => {
      const tripAvailable = await tx.trip.findFirst({
        where: { id: tripId, status: TripStatus.REQUESTED },
      });
      if (!tripAvailable) {
        return res.status(400).json({ error: 'Trip not available' });
      }
      const trip = await tx.trip.update({
        where: { id: tripId, status: TripStatus.REQUESTED },
        data: {
          accepted_by: userId,
          accepted_at: new Date(),
          status: TripStatus.IN_PROGRESS,
        },
      });
      redisPublish.publish(
        `${REDIS_TRIP_KEY}${tripId}`,
        JSON.stringify({
          requested_by: trip.requested_by,
          accepted_by: userId,
          accepted_at: new Date(),
        } as TripAcceptedMessage),
      );
      return res.status(200).json({ trip: trip.id });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export async function driverIsOnTrip(driverUserId: string) {
  const isDriver = await prisma.driver.findFirst({
    where: { user_id: driverUserId },
  });
  if (!isDriver) {
    throw Error(`Driver id not found ${driverUserId}`);
  }
  return await prisma.trips.findFirst({
    where: { accepted_by: driverUserId, status: TripStatus.IN_PROGRESS },
  });
}

export async function riderIsOnTrip(riderUserId: string) {
  const isRider = await prisma.rider.findFirst({
    where: { user_id: riderUserId },
  });
  if (!isRider) {
    throw Error(`Rider id not found ${riderUserId}`);
  }
  return await prisma.trips.findFirst({
    where: { accepted_by: riderUserId, status: TripStatus.IN_PROGRESS },
  });
}

export default router;
