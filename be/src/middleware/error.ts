import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/http-error';
import { config } from '../config';

/** 매칭되는 라우트가 없을 때. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: '요청한 경로를 찾을 수 없습니다.' } });
};

/**
 * 마지막 오류 처리기. HttpError만 메시지를 그대로 내보내고,
 * 나머지는 500으로 감춰 내부 구조가 새지 않게 한다.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: '서버 오류가 발생했습니다.',
      ...(config.isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
    },
  });
};
