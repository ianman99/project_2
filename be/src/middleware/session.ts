import session from 'express-session';
import MongoStore from 'connect-mongo';
import { config } from '../config';
import type { UserRole } from '../types/models';

declare module 'express-session' {
  interface SessionData {
    studentNo: string;
    role: UserRole;
  }
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export function createSessionMiddleware() {
  return session({
    name: 'slis.sid',
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      mongoUrl: config.mongo.uri,
      dbName: config.mongo.db,
      collectionName: 'sessions',
      ttl: TWO_WEEKS_MS / 1000,
    }),
    cookie: {
      httpOnly: true,
      // 운영에서는 HTTPS 전제. 개발(http://localhost)에서는 켜면 쿠키가 저장되지 않는다.
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: TWO_WEEKS_MS,
    },
  });
}

/** 세션 고정 공격 방지 — 로그인 성공 시 세션 ID를 새로 발급한다. */
export function regenerateSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}
