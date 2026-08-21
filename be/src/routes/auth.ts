import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { destroySession, regenerateSession } from '../middleware/session';
import { currentStudentNo, requireAuth } from '../middleware/require-auth';
import {
  completeSignup,
  getPublicUser,
  login,
  requestSignupCode,
  type PublicUser,
} from '../services/auth.service';

export const authRouter = Router();

function requireString(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | null)?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'missing_field', `${field}를 입력해 주세요.`);
  }
  return value;
}

/** 1단계 — 인증코드 발송 */
authRouter.post('/signup/request', async (req, res) => {
  const email = requireString(req.body, 'email');
  res.json({ ok: true, ...(await requestSignupCode(email)) });
});

/** 2단계 — 코드 검증 + 계정 생성. 성공 시 바로 로그인 상태가 된다. */
authRouter.post('/signup/verify', async (req, res) => {
  const email = requireString(req.body, 'email');
  const code = requireString(req.body, 'code');
  const password = requireString(req.body, 'password');

  const user = await completeSignup(email, code, password);
  await startSession(req, user);
  res.status(201).json({ user });
});

authRouter.post('/login', async (req, res) => {
  const email = requireString(req.body, 'email');
  const password = requireString(req.body, 'password');

  const user = await login(email, password);
  await startSession(req, user);
  res.json({ user });
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(req);
  res.clearCookie('slis.sid');
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await getPublicUser(currentStudentNo(req));
  if (!user) {
    // 세션은 있는데 계정이 사라진 경우 — 세션을 정리한다.
    await destroySession(req);
    throw new HttpError(401, 'unauthenticated', '로그인이 필요합니다.');
  }
  res.json({ user });
});

async function startSession(req: Parameters<typeof regenerateSession>[0], user: PublicUser) {
  await regenerateSession(req);
  req.session.studentNo = user.studentNo;
  req.session.role = user.role;
}
