import { Router } from 'express';
import userLoginRouter from './user/login';
import userRegisterRouter from './user/register';
import userSearchRouter from './user/search';

const router = Router();

router.use('/login', userLoginRouter);
router.use('/register', userRegisterRouter);
router.use('/search', userSearchRouter);

export default router;
