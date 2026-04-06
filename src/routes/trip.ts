import { Request, Response, Router } from 'express';
import { prisma } from '../db/prisma';
import { redisPublish, redisSubscribe } from '../server';
import {
  REDIS_TRIP_KEY,
  REDIS_TRIPS_AVAILABLE_KEY,
  TRIP_ACCEPTED,
  TRIP_AVAILABLE,
  TRIP_UPDATED,
  TripAcceptedMessage,
  TripAvailableMessage,
  TripRequest,
  TripUpdatedMessage,
} from '../types/trip';
import { TripStatus } from '../generated/prisma/enums';
import { riderCanRequest, userIdValid, userIsDriver } from '../utils/db/user';

const router = Router();

// Request a trip
router.post('/', async (req: Request, res: Response) => {
  if (!(await userIdValid(req, res))) return;
  if (!(await riderCanRequest(req, res))) return;

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
  const { isDriver, driverId } = await userIsDriver(req, res);
  if (!isDriver) return;
  const tripId = req.params.tripId as string;

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
          driver_id: driverId,
          accepted_at: new Date(),
          status: TripStatus.ACCEPTED,
        },
      });
      redisPublish.publish(
        `${REDIS_TRIP_KEY}${tripId}`,
        JSON.stringify({
          type: TRIP_ACCEPTED,
          rider_id: trip.rider_id,
          driver_id: driverId,
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

// Pick up passenger
router.put('/:tripId/pickup', async (req: Request, res: Response) => {
  if (!(await userIdValid(req, res))) return;
  const { isDriver, driverId } = await userIsDriver(req, res);
  if (!isDriver) return;
  const tripId = req.params.tripId as string;

  try {
    return prisma.$transaction(async (tx) => {
      const tripAvailable = await tx.trip.findFirst({
        where: { id: tripId, status: TripStatus.ACCEPTED, driver_id: driverId },
      });
      if (!tripAvailable) {
        return res.status(400).json({ error: 'Trip not available' });
      }
      const trip = await tx.trip.update({
        where: { id: tripId, status: TripStatus.ACCEPTED },
        data: {
          status: TripStatus.IN_PROGRESS,
          picked_up_at: new Date(),
        },
      });
      redisPublish.publish(
        `${REDIS_TRIP_KEY}${tripId}`,
        JSON.stringify({
          type: TRIP_UPDATED,
          status: TripStatus.IN_PROGRESS,
          picked_up_at: new Date(),
        } as TripUpdatedMessage),
      );
      return res.status(200).json({ trip: trip.id });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
