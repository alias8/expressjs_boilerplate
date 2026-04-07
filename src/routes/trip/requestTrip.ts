import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { redisPublish, redisSubscribe } from '../../server';
import {
  REDIS_TRIP_KEY,
  REDIS_TRIPS_AVAILABLE_KEY,
  TRIP_AVAILABLE,
  TripAvailableMessage,
  TripRequest,
} from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { riderCanRequest, userIdValid } from '../../utils/db/user';

const router = Router();

// Request a trip
router.post('/', async (req: Request, res: Response) => {
  const jwtToken = req.user;
  const userId = jwtToken?.userId;
  if (!(await userIdValid(req, res))) return;
  if (!(await riderCanRequest(req, res))) return;

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

export default router;
