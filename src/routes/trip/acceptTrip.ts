import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { redisPublish } from '../../server';
import { REDIS_TRIP_CHANNEL, TRIP_ACCEPTED, TripAcceptedMessage } from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { getUserIdFromToken, userIsDriver } from '../../utils/db/user';

const router = Router();

// Accept a trip
router.put('/:tripId', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req, res);
  if (!userId) return;
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
        rider_id: trip.rider_id,
        driver_id: driverId,
        accepted_at: new Date(),
      };
      redisPublish.publish(`${REDIS_TRIP_CHANNEL}${tripId}`, JSON.stringify(messageToSend));
      return res.status(200).json({ trip: trip.id });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
