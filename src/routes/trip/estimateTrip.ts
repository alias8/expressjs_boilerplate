import { Request, Response, Router } from 'express';
import { getJwtToken } from '../../utils/db/user';
import haversine from 'haversine-distance';
import { findNearbyDrivers, NEARBY_DRIVER_SEARCH_DEFAULT_RADIUS } from './nearbyDrivers';
import { redisGeo } from '../../server';

const router = Router();

const FLAT_FEE = 10;
const KM_COST_RATE = 2;
export const REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER = 'userLookingForDriver';
export const REDIS_GEO_ACTIVE_RIDER = `riderActive:`;

// Estimate a trip
router.get('/', async (req: Request, res: Response) => {
  const token = getJwtToken(req, res);
  if (!token) return;
  const { userId } = token;

  try {
    const { startGPSLatitude, startGPSLongitude, endGPSLatitude, endGPSLongitude } = req.query;
    if (!startGPSLatitude || !startGPSLongitude || !endGPSLatitude || !endGPSLongitude) {
      return res.status(400).json({ error: 'Missing coordinates' });
    }
    const startGPSLatitudeAsNumber = parseFloat(startGPSLatitude as string);
    const startGPSLongitudeAsNumber = parseFloat(startGPSLongitude as string);
    const start = {
      lat: startGPSLatitudeAsNumber,
      lng: startGPSLongitudeAsNumber,
    };
    const end = {
      lat: parseFloat(endGPSLatitude as string),
      lng: parseFloat(endGPSLongitude as string),
    };
    if (isNaN(start.lat) || isNaN(start.lng) || isNaN(end.lat) || isNaN(end.lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    const distanceInKm = haversine(start, end) / 1000;
    await Promise.all([
      redisGeo.geoadd(
        REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER,
        startGPSLongitudeAsNumber,
        startGPSLatitudeAsNumber,
        userId,
      ),
      // Separate redis key, add rider to an active riders pool with 1 minute expiry
      redisGeo.set(`${REDIS_GEO_ACTIVE_RIDER}${userId}`, '1', 'EX', 60),
    ]);
    const surgeMultiplier = await getSurgeMultiplier(
      startGPSLatitudeAsNumber,
      startGPSLongitudeAsNumber,
    );

    const cost: number = Number(
      ((FLAT_FEE + distanceInKm * KM_COST_RATE) * surgeMultiplier).toFixed(2),
    );
    return res.status(200).json({ cost });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

// Remove rider from nearby rider redis pool. This is called when the user closes the uber app
router.delete('/', async (req: Request, res: Response) => {
  const token = getJwtToken(req, res);
  if (!token) return;
  const { userId } = token;
  try {
    await redisGeo.zrem(REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER, userId);
    return res.status(200).json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

async function getSurgeMultiplier(currentGPSLatitude: number, currentGPSLongitude: number) {
  // We expect 1 rider per nearby driver, normal
  // 2 rider per nearby driver, medium surge
  // 3 or more rider per nearby driver, high surge

  // look up how many nearby drivers
  const nearbyDriversCount = (await findNearbyDrivers(currentGPSLatitude, currentGPSLongitude))
    .length;
  if (nearbyDriversCount === 0) return 3;
  const nearbyRidersCount = await findNearbyRidersLookingForTrip(
    currentGPSLatitude,
    currentGPSLongitude,
  );
  const ratio = nearbyRidersCount / nearbyDriversCount;
  if (ratio > 3) {
    return 3;
  } else if (ratio > 2) {
    return 2;
  } else {
    return 1;
  }
}

export async function findNearbyRidersLookingForTrip(
  currentGPSLatitude: number,
  currentGPSLongitude: number,
) {
  const nearbyRiders = (await redisGeo.geosearch(
    REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER,
    'FROMLONLAT',
    currentGPSLongitude,
    currentGPSLatitude,
    'BYRADIUS',
    NEARBY_DRIVER_SEARCH_DEFAULT_RADIUS,
    'km',
  )) as string[];
  const activeRiders = await Promise.all(
    nearbyRiders.map(async (riderId) => {
      const active = await redisGeo.exists(`${REDIS_GEO_ACTIVE_RIDER}${riderId}`);
      return active ? riderId : null;
    }),
  );
  return activeRiders.filter(Boolean).length;
}

export default router;
