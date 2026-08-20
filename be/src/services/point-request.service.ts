import { ObjectId } from 'mongodb';
import { pointRequests, students, users } from '../db/collections';
import { HttpError } from '../lib/http-error';
import { grant } from './points.service';
import type { PointRequestDoc } from '../types/models';

const MAX_MESSAGE = 300;

export async function submitRequest(userId: string, message: string) {
  const text = message.trim();
  if (!text) throw new HttpError(400, 'no_message', '요청 사유를 입력해 주세요.');
  if (text.length > MAX_MESSAGE) {
    throw new HttpError(400, 'message_too_long', `사유는 ${MAX_MESSAGE}자 이내로 입력해 주세요.`);
  }
  if (await pointRequests().findOne({ userId, status: 'pending' })) {
    throw new HttpError(409, 'pending_exists', '이미 검토 중인 충전 요청이 있습니다.');
  }

  const doc: PointRequestDoc = {
    _id: new ObjectId(),
    userId,
    message: text,
    status: 'pending',
    requestedAt: new Date(),
    resolvedAt: null,
    resolvedBy: null,
    grantedPoints: null,
  };
  await pointRequests().insertOne(doc);
  return toPublic(doc);
}

export async function myRequests(userId: string) {
  const docs = await pointRequests()
    .find({ userId })
    .sort({ requestedAt: -1 })
    .limit(10)
    .toArray();
  return docs.map(toPublic);
}

export async function listRequests(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const docs = await pointRequests().find({ status }).sort({ requestedAt: -1 }).limit(50).toArray();
  const names = await nameMap();
  return docs.map((d) => ({ ...toPublic(d), userName: names.get(d.userId) ?? d.userId }));
}

/** 승인 — 지정한 금액을 지급한다. 상한 없음 (PRD Q11). */
export async function approveRequest(requestId: string, amount: number, adminId: string) {
  const request = await claim(requestId, 'approved', adminId, amount);
  await grant(request.userId, amount, adminId, `충전 요청 승인: ${request.message}`);
  return toPublic({ ...request, status: 'approved', grantedPoints: amount });
}

export async function rejectRequest(requestId: string, adminId: string) {
  const request = await claim(requestId, 'rejected', adminId, null);
  return toPublic({ ...request, status: 'rejected' });
}

/** 전체 사용자 잔액 (어드민 화면용) */
export async function allBalances() {
  const list = await users().find({}, { projection: { points: 1, role: 1 } }).toArray();
  const names = await nameMap();
  return list
    .map((u) => ({ userId: u._id, name: names.get(u._id) ?? u._id, points: u.points, role: u.role }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

async function nameMap() {
  const docs = await students().find({}, { projection: { name: 1 } }).toArray();
  return new Map(docs.map((s) => [s._id, s.name]));
}

/** pending일 때만 상태를 바꾼다. 두 번 눌러도 한 번만 지급된다. */
async function claim(
  requestId: string,
  status: 'approved' | 'rejected',
  adminId: string,
  grantedPoints: number | null,
) {
  if (!ObjectId.isValid(requestId)) {
    throw new HttpError(400, 'invalid_id', '잘못된 요청 ID입니다.');
  }
  if (status === 'approved' && (!Number.isInteger(grantedPoints) || (grantedPoints ?? 0) <= 0)) {
    throw new HttpError(400, 'invalid_amount', '지급 금액은 1 이상의 정수여야 합니다.');
  }

  const request = await pointRequests().findOneAndUpdate(
    { _id: new ObjectId(requestId), status: 'pending' },
    { $set: { status, resolvedBy: adminId, resolvedAt: new Date(), grantedPoints } },
    { returnDocument: 'before' },
  );
  if (!request) {
    throw new HttpError(404, 'not_pending', '이미 처리되었거나 존재하지 않는 요청입니다.');
  }
  return request;
}

function toPublic(d: PointRequestDoc) {
  return {
    id: d._id.toHexString(),
    userId: d.userId,
    message: d.message,
    status: d.status,
    requestedAt: d.requestedAt,
    resolvedAt: d.resolvedAt,
    grantedPoints: d.grantedPoints,
  };
}
