import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { REDIS_TRIP_CHANNEL, TRIP_DROPPED_OFF, TripUpdatedDropOffMessage } from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { getJwtToken, userIsDriver } from '../../utils/db/user';
import { publishToRedis } from '../../utils/redis';
import { redisSubscribe } from '../../server';
import { asUserId } from '../../types/user';

const router = Router();

interface DropOffPassengerRequest {
  currentGPSLatitude: number;
  currentGPSLongitude: number;
}

// Drop off passenger
router.put('/:tripId', async (req: Request, res: Response) => {
  const token = getJwtToken(req, res);
  if (!token) return;
  const userId = asUserId(token.userId);
  const { isDriver, driverId } = await userIsDriver(userId, res);
  if (!isDriver) return;
  const tripId = req.params.tripId as string;
  const { currentGPSLatitude, currentGPSLongitude } = req.body as DropOffPassengerRequest;

  try {
    return prisma.$transaction(async (tx) => {
      const tripAvailable = await tx.trip.findFirst({
        where: { id: tripId, status: TripStatus.IN_PROGRESS, driver_id: driverId },
      });
      if (!tripAvailable) {
        return res.status(400).json({ error: 'Trip not in progress' });
      }
      const trip = await tx.trip.update({
        where: { id: tripId, status: TripStatus.IN_PROGRESS },
        data: {
          status: TripStatus.COMPLETED,
          endGPSLatitude_actual: currentGPSLatitude,
          endGPSLongitude_actual: currentGPSLongitude,
          dropped_off_at: new Date(),
        },
      });
      const messageToSend: TripUpdatedDropOffMessage = {
        type: TRIP_DROPPED_OFF,
        dropped_off_at: trip.dropped_off_at!,
        tripId,
        rider_id: trip.rider_id,
        endGPSLatitude_actual: currentGPSLatitude,
        endGPSLongitude_actual: currentGPSLongitude,
      };
      publishToRedis(`${REDIS_TRIP_CHANNEL}${tripId}`, messageToSend); // todo: use outbox pattern
      redisSubscribe.unsubscribe(`${REDIS_TRIP_CHANNEL}${trip.id}`); // trip complete, get rid of sub
      return res.status(200).json({ trip: trip.id });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
