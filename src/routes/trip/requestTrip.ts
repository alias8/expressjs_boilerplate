import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { redisPublish, redisSubscribe } from '../../server';
import {
  REDIS_TRIP_CHANNEL,
  REDIS_TRIPS_AVAILABLE_CHANNEL,
  TRIP_AVAILABLE,
  TripAvailableMessage,
  TripRequest,
} from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { getUserIdFromToken, riderCanRequest } from '../../utils/db/user';

const router = Router();

// Request a trip
router.post('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req, res);
  if (!userId) return;
  if (!(await riderCanRequest(userId!, res))) return;

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
    const messageToSend: TripAvailableMessage = {
      type: TRIP_AVAILABLE,
      tripId: trip.id,
      startGPSLatitude,
      startGPSLongitude,
      endGPSLatitude,
      endGPSLongitude,
      requested_at: new Date(),
      requested_by: userId,
    };
    // Publish to drivers listening for this
    redisPublish.publish(
      // we are just hardcoding to 1 city atm, but we want to be able to publish to the nearest big city
      REDIS_TRIPS_AVAILABLE_CHANNEL,
      JSON.stringify(messageToSend),
    );
    redisSubscribe.subscribe(`${REDIS_TRIP_CHANNEL}${trip.id}`); // Listen for updates on this trip
    return res.status(200).json({ trip: trip.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
