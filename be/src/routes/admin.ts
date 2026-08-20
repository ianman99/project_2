import { Router } from 'express';
import { currentStudentNo, requireAdmin, requireAuth } from '../middleware/require-auth';
import { approveRequest, listRequests, rejectRequest } from '../services/profile-edit.service';
import {
  allBalances,
  approveRequest as approvePointRequest,
  listRequests as listPointRequests,
  rejectRequest as rejectPointRequest,
} from '../services/point-request.service';
import { grant } from '../services/points.service';
import { HttpError } from '../lib/http-error';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/edit-requests', async (req, res) => {
  const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;
  res.json({ items: await listRequests(status ?? 'pending') });
});

adminRouter.post('/edit-requests/:id/approve', async (req, res) => {
  res.json({ request: await approveRequest(req.params.id, currentStudentNo(req)) });
});

adminRouter.post('/edit-requests/:id/reject', async (req, res) => {
  res.json({ request: await rejectRequest(req.params.id, currentStudentNo(req)) });
});

/** 충전 요청 목록 */
adminRouter.get('/point-requests', async (req, res) => {
  const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;
  res.json({ items: await listPointRequests(status ?? 'pending') });
});

adminRouter.post('/point-requests/:id/approve', async (req, res) => {
  const amount = Number((req.body as { amount?: unknown })?.amount);
  const request = await approvePointRequest(req.params.id, amount, currentStudentNo(req));
  res.json({ request });
});

adminRouter.post('/point-requests/:id/reject', async (req, res) => {
  res.json({ request: await rejectPointRequest(req.params.id, currentStudentNo(req)) });
});

/** 요청 없이 직접 지급 */
adminRouter.post('/grant', async (req, res) => {
  const { userId, amount, memo } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof userId !== 'string' || !userId) {
    throw new HttpError(400, 'missing_field', '대상 학번을 선택해 주세요.');
  }
  const balance = await grant(userId, Number(amount), currentStudentNo(req), String(memo ?? '어드민 직접 지급'));
  res.json({ userId, balance });
});

/** 전체 사용자 잔액 */
adminRouter.get('/balances', async (_req, res) => {
  res.json({ items: await allBalances() });
});
