import { Router } from 'express';
import { currentStudentNo, requireAuth } from '../middleware/require-auth';
import { students } from '../db/collections';
import { HttpError } from '../lib/http-error';
import {
  editableSnapshot,
  myRequests,
  submitEditRequest,
} from '../services/profile-edit.service';

export const profileRouter = Router();

profileRouter.use(requireAuth);

/**
 * 본인 프로필. 세션의 학번으로만 조회하며 다른 학번은 지정할 수 없다 (PRD S-3, S-5).
 * 본인 데이터이므로 phone은 포함하되, 아래는 제외한다.
 * - matching: AI 입력용 파생 데이터 (원본은 다른 섹션에 있음)
 * - _id / id: 학번은 상단 "내 정보"에 이미 있음
 * - _type / _schema_version / _snapshot_date / data_quality: 내부 메타
 */
const HIDDEN = {
  matching: 0,
  _id: 0,
  id: 0,
  _type: 0,
  _schema_version: 0,
  _snapshot_date: 0,
  data_quality: 0,
} as const;

profileRouter.get('/', async (req, res) => {
  const doc = await students().findOne({ _id: currentStudentNo(req) }, { projection: HIDDEN });
  if (!doc) throw new HttpError(404, 'no_profile', '프로필을 찾을 수 없습니다.');
  res.json({ profile: doc });
});

/** 수정 가능한 필드와 현재 값 */
profileRouter.get('/editable', async (req, res) => {
  res.json(await editableSnapshot(currentStudentNo(req)));
});

/** 수정 요청 제출 — 어드민 승인 전까지 반영되지 않는다. */
profileRouter.post('/edit-request', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const request = await submitEditRequest(currentStudentNo(req), body);
  res.status(201).json({ request });
});

/** 내가 보낸 수정 요청 이력 */
profileRouter.get('/edit-requests', async (req, res) => {
  res.json({ items: await myRequests(currentStudentNo(req)) });
});
