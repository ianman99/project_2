import { ObjectId } from 'mongodb';
import { profileEditRequests, students } from '../db/collections';
import { HttpError } from '../lib/http-error';
import { EDITABLE_FIELDS, findField, getByPath } from '../lib/editable-fields';
import type { ProfileEditChange, ProfileEditRequestDoc } from '../types/models';

/** 현재 값과 함께 수정 가능한 필드 목록을 준다. */
export async function editableSnapshot(userId: string) {
  const doc = await students().findOne({ _id: userId });
  if (!doc) throw new HttpError(404, 'no_profile', '프로필을 찾을 수 없습니다.');

  const pending = await profileEditRequests().findOne({ userId, status: 'pending' });

  return {
    fields: EDITABLE_FIELDS.map((f) => ({ ...f, value: getByPath(doc, f.path) ?? null })),
    pending: pending ? toPublic(pending) : null,
  };
}

/** 값을 필드 타입에 맞게 정규화한다. 문자열은 trim, list는 쉼표 분리. */
function normalize(type: string, raw: unknown): string | string[] | null {
  if (type === 'list') {
    const items = Array.isArray(raw)
      ? raw.map(String)
      : String(raw ?? '')
          .split(',')
          .map((s) => s.trim());
    return items.filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  return text === '' ? null : text;
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function submitEditRequest(userId: string, input: Record<string, unknown>) {
  const doc = await students().findOne({ _id: userId });
  if (!doc) throw new HttpError(404, 'no_profile', '프로필을 찾을 수 없습니다.');

  if (await profileEditRequests().findOne({ userId, status: 'pending' })) {
    throw new HttpError(409, 'pending_exists', '이미 검토 중인 수정 요청이 있습니다.');
  }

  const changes: ProfileEditChange[] = [];
  for (const [path, raw] of Object.entries(input)) {
    const field = findField(path);
    // 화이트리스트 밖의 경로는 조용히 버리지 않고 거부한다.
    if (!field) throw new HttpError(400, 'field_not_editable', `수정할 수 없는 항목입니다: ${path}`);

    const before = getByPath(doc, path) ?? null;
    const after = normalize(field.type, raw);
    if (!sameValue(before, after)) {
      changes.push({ path, label: field.label, before, after });
    }
  }

  if (changes.length === 0) {
    throw new HttpError(400, 'no_changes', '변경된 내용이 없습니다.');
  }

  const request: ProfileEditRequestDoc = {
    _id: new ObjectId(),
    userId,
    changes,
    status: 'pending',
    requestedAt: new Date(),
    resolvedAt: null,
    resolvedBy: null,
  };
  await profileEditRequests().insertOne(request);
  return toPublic(request);
}

/** 본인 요청 이력. 상태와 무관하게 최근 순으로 준다. */
export async function myRequests(userId: string) {
  const docs = await profileEditRequests()
    .find({ userId })
    .sort({ requestedAt: -1 })
    .limit(10)
    .toArray();
  return docs.map(toPublic);
}

export async function listRequests(status?: 'pending' | 'approved' | 'rejected') {
  const docs = await profileEditRequests()
    .find(status ? { status } : {})
    .sort({ requestedAt: -1 })
    .limit(50)
    .toArray();

  const names = new Map(
    (await students().find({}, { projection: { name: 1 } }).toArray()).map((s) => [s._id, s.name]),
  );
  return docs.map((d) => ({ ...toPublic(d), userName: names.get(d.userId) ?? d.userId }));
}

/** 승인 — 변경분을 students에 반영한다. */
export async function approveRequest(requestId: string, adminId: string) {
  const request = await claim(requestId, 'approved', adminId);

  const $set: Record<string, unknown> = {};
  for (const change of request.changes) $set[change.path] = change.after;
  await students().updateOne({ _id: request.userId }, { $set });

  return toPublic({ ...request, status: 'approved', resolvedBy: adminId, resolvedAt: new Date() });
}

export async function rejectRequest(requestId: string, adminId: string) {
  const request = await claim(requestId, 'rejected', adminId);
  return toPublic({ ...request, status: 'rejected', resolvedBy: adminId, resolvedAt: new Date() });
}

/** pending 상태일 때만 상태를 바꾼다. 두 번 눌러도 한 번만 처리된다. */
async function claim(requestId: string, status: 'approved' | 'rejected', adminId: string) {
  if (!ObjectId.isValid(requestId)) {
    throw new HttpError(400, 'invalid_id', '잘못된 요청 ID입니다.');
  }
  const request = await profileEditRequests().findOneAndUpdate(
    { _id: new ObjectId(requestId), status: 'pending' },
    { $set: { status, resolvedBy: adminId, resolvedAt: new Date() } },
    { returnDocument: 'before' },
  );
  if (!request) {
    throw new HttpError(404, 'not_pending', '이미 처리되었거나 존재하지 않는 요청입니다.');
  }
  return request;
}

function toPublic(d: ProfileEditRequestDoc) {
  return {
    id: d._id.toHexString(),
    userId: d.userId,
    changes: d.changes,
    status: d.status,
    requestedAt: d.requestedAt,
    resolvedAt: d.resolvedAt,
    resolvedBy: d.resolvedBy,
  };
}
