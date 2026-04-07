import { Router } from 'express';
import requestTripRouter from './trip/requestTrip';
import acceptTripRouter from './trip/acceptTrip';
import pickUpPassengerRouter from './trip/pickUpPassenger';

const router = Router();

router.use('/request', requestTripRouter);
router.use('/accept', acceptTripRouter);
router.use('/pickup', pickUpPassengerRouter);

export default router;
