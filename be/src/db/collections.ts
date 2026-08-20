import { getCollection } from '../db';
import type {
  EmailVerificationDoc,
  PointTransactionDoc,
  MatchDoc,
  StudentDoc,
  UserDoc,
} from '../types/models';

export const students = () => getCollection<StudentDoc>('students');
export const users = () => getCollection<UserDoc>('users');
export const emailVerifications = () => getCollection<EmailVerificationDoc>('email_verifications');
export const pointTransactions = () => getCollection<PointTransactionDoc>('point_transactions');
export const matches = () => getCollection<MatchDoc>('matches');

/**
 * 기동 시 인덱스를 보장한다. createIndex는 멱등이라 매번 호출해도 안전하다.
 */
export async function ensureIndexes(): Promise<void> {
  await users().createIndex({ email: 1 }, { unique: true });

  await emailVerifications().createIndex({ studentNo: 1, createdAt: -1 });
  // 만료 문서 자동 삭제. expiresAt 시점에 제거된다.
  await emailVerifications().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await pointTransactions().createIndex({ userId: 1, createdAt: -1 });
  await matches().createIndex({ userId: 1, generatedAt: -1 });
}
