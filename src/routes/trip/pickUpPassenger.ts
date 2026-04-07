import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { redisPublish } from '../../server';
import {
  REDIS_TRIP_CHANNEL,
  REDIS_TRIPS_AVAILABLE_CHANNEL,
  TRIP_UPDATED_PICKED_UP,
  TripUpdatedPickUpMessage,
} from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { getUserIdFromToken, userIsDriver } from '../../utils/db/user';
import { publishToRedis } from '../../utils/redis';

const router = Router();

interface PickUpPassengerRequest {
  currentGPSLatitude: number;
  currentGPSLongitude: number;
}

// Pick up passenger
router.put('/:tripId/pickup', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req, res);
  if (!userId) return;
  const { isDriver, driverId } = await userIsDriver(userId, res);
  if (!isDriver) return;
  const tripId = req.params.tripId as string;
  const { currentGPSLatitude, currentGPSLongitude } = req.body as PickUpPassengerRequest;

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
      const messageToSend: TripUpdatedPickUpMessage = {
        type: TRIP_UPDATED_PICKED_UP,
        status: TripStatus.IN_PROGRESS,
        picked_up_at: new Date(),
        tripId,
        rider_id: trip.rider_id,
        currentGPSLatitude,
        currentGPSLongitude,
      };
      publishToRedis(`${REDIS_TRIP_CHANNEL}${tripId}`, messageToSend);
      return res.status(200).json({ trip: trip.id });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
