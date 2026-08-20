import { Router } from 'express';
import { currentStudentNo, requireAdmin, requireAuth } from '../middleware/require-auth';
import { approveRequest, listRequests, rejectRequest } from '../services/profile-edit.service';

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
