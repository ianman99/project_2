import path from 'node:path';
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

  // API는 전부 /api 아래에 둔다. 프론트 라우트(/admin, /my 등)와 겹치지 않게 하기 위함.
  app.use('/health', healthRouter); // 플랫폼 헬스체크용으로 루트에도 남긴다
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/points', pointsRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/admin', adminRouter);

  if (config.server.staticDir) serveFrontend(app, config.server.staticDir);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const API_PREFIXES = ['/api', '/health'];

/**
 * 프론트 빌드본을 같은 서버에서 서빙한다.
 * 한 오리진으로 묶이면 CORS도, 크로스사이트 쿠키 문제도 생기지 않는다.
 */
function serveFrontend(app: express.Express, staticDir: string) {
  // sendFile은 절대경로를 요구한다.
  const dir = path.resolve(staticDir);
  // 해시가 붙은 에셋은 오래 캐시하고, index.html은 캐시하지 않는다.
  app.use(express.static(dir, { index: false, maxAge: '1y' }));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || API_PREFIXES.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }
    // SPA 라우팅 — 나머지 경로는 index.html로 넘긴다.
    res.sendFile(path.join(dir, 'index.html'));
  });
}
