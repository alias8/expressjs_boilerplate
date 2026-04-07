import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import createError, { HttpError } from 'http-errors';

import tripRouter from './routes/trip';
import usersRouter from './routes/users';
import { authenticateJwtToken } from './middleware/auth';

export const app = express();

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(authenticateJwtToken);

app.use('/users', usersRouter);
app.use('/trip', tripRouter); // protected route

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

// error handler
app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
  res.status(err.status || 500).json({ error: err.message });
});

export default app;
