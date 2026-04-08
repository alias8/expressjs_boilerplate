import { Router } from 'express';
import requestTripRouter from './trip/requestTrip';
import acceptTripRouter from './trip/acceptTrip';
import pickUpPassengerRouter from './trip/pickUpPassenger';
import dropOffPassengerRouter from './trip/dropOffPassenger';
import rateRouter from './trip/rateTrip';
import nearbyDrivers from './trip/nearbyDrivers';

const router = Router();

router.use('/request', requestTripRouter);
router.use('/accept', acceptTripRouter);
router.use('/pickup', pickUpPassengerRouter);
router.use('/dropoff', dropOffPassengerRouter);
router.use('/rate', rateRouter);
router.use('/nearbydrivers', nearbyDrivers);

export default router;
