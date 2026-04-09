import { Request, Response, Router } from 'express';
import { redisGeo } from '../../server';
import { getJwtToken, riderCanRequest } from '../../utils/db/user';
import { REDIS_DRIVER_LOCATION, REDIS_DRIVER_LOCATION_PREFIX } from '../../types/drivers';
import { asUserId } from '../../types/user';

const router = Router();

interface FindNearbyDriversRequest {
  currentGPSLatitude: number;
  currentGPSLongitude: number;
}

export type NearbyDriverOrRiderResult = [string, [string, string]];

export const NEARBY_DRIVER_SEARCH_DEFAULT_RADIUS = 20;

// Get nearby drivers
router.post('/', async (req: Request, res: Response) => {
  const token = getJwtToken(req, res);
  if (!token) return;
  const userId = asUserId(token.userId);
  if (!(await riderCanRequest(userId, res))) return;

  const { currentGPSLatitude, currentGPSLongitude } = req.body as FindNearbyDriversRequest;

  try {
    const nearbyDrivers = await findNearbyDrivers(currentGPSLatitude, currentGPSLongitude);
    return res.status(200).json({ nearbyDrivers });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export async function findNearbyDrivers(currentGPSLatitude: number, currentGPSLongitude: number) {
  return await redisGeo
    .geosearch(
      REDIS_DRIVER_LOCATION,
      'FROMLONLAT',
      currentGPSLongitude,
      currentGPSLatitude,
      'BYRADIUS',
      NEARBY_DRIVER_SEARCH_DEFAULT_RADIUS,
      'km',
      'WITHCOORD',
    )
    .then((result) => {
      return (result as NearbyDriverOrRiderResult[]).map((result) => {
        return {
          driverId: result[0].replace(REDIS_DRIVER_LOCATION_PREFIX, ''),
          longitude: result[1][0],
          latitude: result[1][1],
        };
      });
    });
}

export default router;
