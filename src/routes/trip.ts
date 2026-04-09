import { Router } from 'express';
import requestTripRouter from './trip/requestTrip';
import acceptTripRouter from './trip/acceptTrip';
import pickUpPassengerRouter from './trip/pickUpPassenger';
import dropOffPassengerRouter from './trip/dropOffPassenger';
import rateRouter from './trip/rateTrip';
import nearbyDriversRouter from './trip/nearbyDrivers';
import estimateTripRouter from './trip/estimateTrip';

const router = Router();

router.use('/request', requestTripRouter);
router.use('/accept', acceptTripRouter);
router.use('/pickup', pickUpPassengerRouter);
router.use('/dropoff', dropOffPassengerRouter);
router.use('/rate', rateRouter);
router.use('/nearbydrivers', nearbyDriversRouter);
router.use('/estimate', estimateTripRouter);

export default router;
