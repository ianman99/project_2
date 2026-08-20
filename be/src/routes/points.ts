import { Router } from 'express';
import { currentStudentNo, requireAuth } from '../middleware/require-auth';
import { history } from '../services/points.service';
import { users } from '../db/collections';
import { HttpError } from '../lib/http-error';
import { myRequests, submitRequest } from '../services/point-request.service';

export const pointsRouter = Router();

pointsRouter.use(requireAuth);

/** 잔액 + 사용 내역 */
pointsRouter.get('/', async (req, res) => {
  const userId = currentStudentNo(req);
  const [user, transactions] = await Promise.all([
    users().findOne({ _id: userId }, { projection: { points: 1 } }),
    history(userId),
  ]);

  res.json({
    points: user?.points ?? 0,
    transactions: transactions.map((t) => ({
      id: t._id.toHexString(),
      delta: t.delta,
      reason: t.reason,
      memo: t.memo,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
    })),
  });
});

/** 충전 요청 제출 */
pointsRouter.post('/request', async (req, res) => {
  const message = (req.body as { message?: unknown })?.message;
  if (typeof message !== 'string') {
    throw new HttpError(400, 'missing_field', '요청 사유를 입력해 주세요.');
  }
  res.status(201).json({ request: await submitRequest(currentStudentNo(req), message) });
});

/** 내가 보낸 충전 요청 이력 */
pointsRouter.get('/requests', async (req, res) => {
  res.json({ items: await myRequests(currentStudentNo(req)) });
});
