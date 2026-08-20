import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/http-error';

/**
 * requireAuth를 통과한 라우트에서 학번을 꺼낸다.
 * express-session은 SessionData를 Partial로 노출해서 타입상 undefined가 남는다.
 */
export function currentStudentNo(req: Request): string {
  const studentNo = req.session.studentNo;
  if (!studentNo) {
    throw new HttpError(401, 'unauthenticated', '로그인이 필요합니다.');
  }
  return studentNo;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.studentNo) {
    next(new HttpError(401, 'unauthenticated', '로그인이 필요합니다.'));
    return;
  }
  next();
};

/**
 * 어드민 전용. 권한이 없으면 404로 응답한다 —
 * 403은 해당 경로가 존재한다는 사실을 노출한다 (PRD 4.5).
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.session.role !== 'admin') {
    next(new HttpError(404, 'not_found', '요청한 리소스를 찾을 수 없습니다.'));
    return;
  }
  next();
};
