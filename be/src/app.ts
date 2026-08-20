import express from 'express';
import cors from 'cors';
import { config } from './config';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { pointsRouter } from './routes/points';
import { matchesRouter } from './routes/matches';
import { profileRouter } from './routes/profile';
import { adminRouter } from './routes/admin';
import { createSessionMiddleware } from './middleware/session';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();

  // 프록시 뒤에 배포될 경우 클라이언트 IP를 올바르게 읽기 위함.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.server.corsOrigins,
      credentials: true, // 세션 쿠키를 주고받아야 한다 (F-2.3)
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(createSessionMiddleware());

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/points', pointsRouter);
  app.use('/matches', matchesRouter);
  app.use('/profile', profileRouter);
  app.use('/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
