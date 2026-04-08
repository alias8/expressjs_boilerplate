import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { redisSubscribe } from '../../server';
import {
  REDIS_TRIP_CHANNEL,
  REDIS_TRIPS_AVAILABLE_CHANNEL,
  TRIP_AVAILABLE,
  TripAvailableMessage,
  TripRequest,
} from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { getUserIdFromToken, riderCanRequest } from '../../utils/db/user';
import { publishToRedis } from '../../utils/redis';

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
        startGPSLatitude_requested: startGPSLatitude,
        startGPSLongitude_requested: startGPSLongitude,
        endGPSLatitude_requested: endGPSLatitude,
        endGPSLongitude_requested: endGPSLongitude,
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
      requested_at: trip.requested_at,
      requested_by: userId,
    };
    publishToRedis(REDIS_TRIPS_AVAILABLE_CHANNEL, messageToSend);
    // Publish to drivers listening for this
    redisSubscribe.subscribe(`${REDIS_TRIP_CHANNEL}${trip.id}`); // Listen for updates on this trip
    return res.status(200).json({ trip: trip.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
