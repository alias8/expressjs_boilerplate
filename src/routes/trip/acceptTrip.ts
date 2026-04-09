import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { REDIS_TRIP_CHANNEL, TRIP_ACCEPTED, TripAcceptedMessage } from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { getJwtToken, userIsDriver } from '../../utils/db/user';
import { publishToRedis } from '../../utils/redis';
import { redisGeo } from '../../server';
import { REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER } from './estimateTrip';
import { asUserId } from '../../types/user';

const router = Router();

// Driver accepts a trip
router.put('/:tripId', async (req: Request, res: Response) => {
  const token = getJwtToken(req, res);
  if (!token) return;
  const userId = asUserId(token.userId);
  const { isDriver, driverId } = await userIsDriver(userId, res);
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
      const messageToSend: TripAcceptedMessage = {
        type: TRIP_ACCEPTED,
        tripId: trip.id,
        rider_id: trip.rider_id,
        driver_id: driverId,
        accepted_at: trip.accepted_at!,
      };
      publishToRedis(`${REDIS_TRIP_CHANNEL}${tripId}`, messageToSend);
      // Remove rider from redis "looking for driver pool"
      await redisGeo.zrem(REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER, trip.rider_id);
      return res.status(200).json({ trip: trip.id });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
