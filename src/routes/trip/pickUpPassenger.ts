import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { redisPublish } from '../../server';
import { REDIS_TRIP_KEY, TRIP_UPDATED, TripUpdatedMessage } from '../../types/trip';
import { TripStatus } from '../../generated/prisma/enums';
import { userIdValid, userIsDriver } from '../../utils/db/user';

const router = Router();

// Pick up passenger
router.put('/:tripId/pickup', async (req: Request, res: Response) => {
  if (!(await userIdValid(req, res))) return;
  const { isDriver, driverId } = await userIsDriver(req, res);
  if (!isDriver) return;
  const tripId = req.params.tripId as string;
  const currentGPSLatitude = req.query.currentGPSLatitude as string;
  const currentGPSLongitude = req.query.currentGPSLongitude as string;

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
      const messageToSend: TripUpdatedMessage = {
        type: TRIP_UPDATED,
        status: TripStatus.IN_PROGRESS,
        picked_up_at: new Date(),
        tripId,
        rider_id: trip.rider_id,
        currentGPSLatitude: Number.parseInt(currentGPSLatitude),
        currentGPSLongitude: Number.parseInt(currentGPSLongitude),
      };
      redisPublish.publish(`${REDIS_TRIP_KEY}${tripId}`, JSON.stringify(messageToSend));
      return res.status(200).json({ trip: trip.id });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
