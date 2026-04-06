import { Request, Response, Router } from 'express';
import { prisma } from '../db/prisma';
import { redisPublish, redisSubscribe } from '../server';
import {
  REDIS_TRIP_KEY,
  REDIS_TRIPS_AVAILABLE_KEY,
  TRIP_ACCEPTED,
  TRIP_AVAILABLE,
  TripAcceptedMessage,
  TripAvailableMessage,
  TripRequest,
} from '../types/trip';
import { DriverStatus, TripStatus } from '../generated/prisma/enums';

const router = Router();

// Request a trip
router.post('/', async (req: Request, res: Response) => {
  if (!(await userIdValid(req, res))) return;
  if (!(await userCanRequest(req, res))) return;
  const userId = req.query.userId as string;
  const { startGPSLatitude, startGPSLongitude, endGPSLatitude, endGPSLongitude } =
    req.body as TripRequest;

  try {
    const trip = await prisma.trip.create({
      data: {
        startGPSLatitude,
        startGPSLongitude,
        endGPSLatitude,
        endGPSLongitude,
        requested_at: new Date(),
        rider_id: userId,
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
  if (!(await userIdValid(req, res))) return;
  if (!(await userCanRequest(req, res))) return;
  const userId = req.query.userId as string; // would come from jwt in real life
  const tripId = req.params.tripId as string;
  const driverId = await prisma.driver.findFirst({ where: { user_id: userId } });
  if (!driverId) return res.status(400).json({ error: 'User is not a driver' });

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
          driver_id: userId,
          accepted_at: new Date(),
          status: TripStatus.IN_PROGRESS,
        },
      });
      redisPublish.publish(
        `${REDIS_TRIP_KEY}${tripId}`,
        JSON.stringify({
          type: TRIP_ACCEPTED,
          rider_id: trip.rider_id,
          driver_id: userId,
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

async function userIdValid(req: Request, res: Response) {
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

async function userCanRequest(req: Request, res: Response) {
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
    where: { rider_id: userId, status: TripStatus.IN_PROGRESS },
  });
  if (onTripAlready) {
    res.status(400).json({ error: 'Cannot request a ride while already on a trip' });
    return false;
  }
  return true;
}

export default router;
