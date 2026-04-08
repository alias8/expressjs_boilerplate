import { Request, Response, Router } from 'express';
import { prisma } from '../../db/prisma';
import { REDIS_TRIP_CHANNEL, TRIP_DROPPED_OFF, TripUpdatedDropOffMessage } from '../../types/trip';
import { Rating, TripStatus, UserType } from '../../generated/prisma/enums';
import { getJwtToken, userIsDriver } from '../../utils/db/user';
import { publishToRedis } from '../../utils/redis';

const router = Router();

interface RatingRequest {
  rating: Rating;
}

// Rate trip
router.put('/:tripId', async (req: Request, res: Response) => {
  const token = getJwtToken(req, res);
  if (!token) return;
  const { userType } = token;
  const tripId = req.params.tripId as string;
  const { rating } = req.body as RatingRequest;

  try {
    const ratingForDB = {
      ...(userType === UserType.RIDER && { ratingForDriver: rating }),
      ...(userType === UserType.DRIVER && { ratingForRider: rating }),
    };
    const trip = await prisma.trip.update({
      where: { id: tripId, status: TripStatus.COMPLETED },
      data: {
        ...ratingForDB,
      },
    });
    return res.status(200).json({ trip: trip.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
