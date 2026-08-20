import { ObjectId } from 'mongodb';
import { pointTransactions, users } from '../db/collections';
import { HttpError } from '../lib/http-error';
import type { PointReason, PointTransactionDoc } from '../types/models';

export interface SpendInput {
  userId: string;
  amount: number;
  reason: PointReason;
  refId?: ObjectId;
  memo?: string;
}

/**
 * 잔액이 충분할 때만 차감한다.
 * findOneAndUpdate 한 번으로 조건 검사와 차감을 처리해서 동시 요청에도 잔액이 음수가 되지 않는다.
 */
export async function spend({ userId, amount, reason, refId, memo }: SpendInput): Promise<number> {
  const updated = await users().findOneAndUpdate(
    { _id: userId, points: { $gte: amount } },
    { $inc: { points: -amount } },
    { returnDocument: 'after' },
  );

  if (!updated) {
    const user = await users().findOne({ _id: userId }, { projection: { points: 1 } });
    if (!user) throw new HttpError(401, 'unauthenticated', '로그인이 필요합니다.');
    throw new HttpError(
      400,
      'insufficient_points',
      `포인트가 부족합니다. (필요 ${amount.toLocaleString()} P · 보유 ${user.points.toLocaleString()} P)`,
    );
  }

  await record(userId, -amount, reason, updated.points, { refId, memo });
  return updated.points;
}

/** 어드민 지급. 상한 없음 (PRD Q11). */
export async function grant(
  userId: string,
  amount: number,
  grantedBy: string,
  memo?: string,
): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, 'invalid_amount', '지급 금액은 1 이상의 정수여야 합니다.');
  }

  const updated = await users().findOneAndUpdate(
    { _id: userId },
    { $inc: { points: amount } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'user_not_found', '해당 사용자를 찾을 수 없습니다.');

  await record(userId, amount, 'admin_grant', updated.points, { grantedBy, memo });
  return updated.points;
}

export function history(userId: string, limit = 50): Promise<PointTransactionDoc[]> {
  return pointTransactions().find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

async function record(
  userId: string,
  delta: number,
  reason: PointReason,
  balanceAfter: number,
  extra: { refId?: ObjectId; grantedBy?: string; memo?: string },
) {
  await pointTransactions().insertOne({
    _id: new ObjectId(),
    userId,
    delta,
    reason,
    refId: extra.refId ?? null,
    grantedBy: extra.grantedBy ?? null,
    memo: extra.memo ?? null,
    balanceAfter,
    createdAt: new Date(),
  });
}
