import { Router } from 'express';
import { currentStudentNo, requireAuth } from '../middleware/require-auth';
import { history } from '../services/points.service';
import { users } from '../db/collections';

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
