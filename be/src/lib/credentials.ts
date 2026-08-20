import { randomInt, timingSafeEqual, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 6자리 숫자 인증코드. 앞자리 0도 허용한다. */
export function generateVerificationCode(): string {
  const max = 10 ** config.verification.codeLength;
  return String(randomInt(0, max)).padStart(config.verification.codeLength, '0');
}

/**
 * 인증코드는 짧고 엔트로피가 낮아 bcrypt를 쓸 이유가 없다.
 * 시도 횟수 제한이 실질적 방어이고, 저장 시 평문만 피하면 된다.
 */
export function hashVerificationCode(code: string): string {
  return createHash('sha256').update(`${code}:${config.auth.sessionSecret}`).digest('hex');
}

export function verificationCodeMatches(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashVerificationCode(code));
  const expected = Buffer.from(expectedHash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
