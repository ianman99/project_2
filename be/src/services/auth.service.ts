import { ObjectId } from 'mongodb';
import { config } from '../config';
import { emailVerifications, pointTransactions, students, users } from '../db/collections';
import { HttpError } from '../lib/http-error';
import { parseSchoolEmail } from '../lib/school-email';
import {
  generateVerificationCode,
  hashPassword,
  hashVerificationCode,
  verificationCodeMatches,
  verifyPassword,
} from '../lib/credentials';
import { sendOtp, verifyOtp } from '../lib/supabase-otp';
import type { UserDoc, UserRole } from '../types/models';

const MIN_PASSWORD_LENGTH = 8;

export interface PublicUser {
  studentNo: string;
  name: string;
  email: string;
  points: number;
  role: UserRole;
}

/** 1단계 — 이메일 검증 후 인증코드를 발송한다. */
export type CodeDelivery = 'email' | 'admin';

export async function requestSignupCode(
  rawEmail: string,
): Promise<{ expiresInMinutes: number; delivery: CodeDelivery }> {
  const { email, studentNo } = parseSchoolEmail(rawEmail);

  // 명단 대조: students에 없는 학번은 거부 (PRD F-1.2)
  const student = await students().findOne({ _id: studentNo }, { projection: { name: 1 } });
  if (!student) {
    throw new HttpError(400, 'unknown_student', '등록되지 않은 학번입니다.');
  }

  // 중복 가입 차단 (PRD F-1.7)
  if (await users().findOne({ _id: studentNo }, { projection: { _id: 1 } })) {
    throw new HttpError(409, 'already_registered', '이미 가입된 학번입니다. 로그인해 주세요.');
  }

  // 재발송 쿨다운 (PRD F-1.6)
  const latest = await emailVerifications().findOne(
    { studentNo },
    { sort: { createdAt: -1 }, projection: { createdAt: 1 } },
  );
  if (latest) {
    const elapsedSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;
    const remaining = Math.ceil(config.verification.resendCooldownSeconds - elapsedSeconds);
    if (remaining > 0) {
      throw new HttpError(429, 
        'resend_cooldown',
        `${remaining}초 후에 다시 요청할 수 있습니다.`,
      );
    }
  }

  return {
    expiresInMinutes: config.verification.expiresInMinutes,
    delivery: await deliver(email, studentNo),
  };
}

/**
 * Supabase가 설정돼 있으면 메일로 보내고, 실패하면 어드민 발급으로 넘어간다.
 * 실제 발송은 Supabase에 연결된 네이버 SMTP가 한다 (DEPLOY.md 참조).
 */
async function deliver(email: string, studentNo: string): Promise<CodeDelivery> {
  if (config.supabase) {
    try {
      await sendOtp(email);
      return 'email';
    } catch (err) {
      // 쿨다운 같은 정상적인 거부는 그대로 알린다. 우회할 일이 아니다.
      if (err instanceof HttpError) throw err;
      console.error('[otp] Supabase 발송 실패 — 어드민 발급으로 전환:', err);
    }
  }
  await issueLocalCode(email, studentNo);
  return 'admin';
}

/** 어드민이 화면에서 읽어 전달할 코드를 만든다 (PRD F-1.9). */
async function issueLocalCode(email: string, studentNo: string): Promise<void> {
  const code = generateVerificationCode();
  const now = new Date();
  await emailVerifications().insertOne({
    _id: new ObjectId(),
    studentNo,
    email,
    code,
    codeHash: hashVerificationCode(code),
    expiresAt: new Date(now.getTime() + config.verification.expiresInMinutes * 60_000),
    attempts: 0,
    consumedAt: null,
    createdAt: now,
  });
}

/** 어드민 발급 코드 검증 — 만료·시도 횟수·일치 여부 (PRD F-1.4, F-1.5) */
async function checkLocalCode(
  record: { _id: ObjectId; codeHash: string; expiresAt: Date; attempts: number },
  code: string,
): Promise<void> {
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(400, 'code_expired', '인증번호가 만료되었습니다. 다시 요청해 주세요.');
  }
  if (record.attempts >= config.verification.maxAttempts) {
    throw new HttpError(400, 'too_many_attempts', '시도 횟수를 초과했습니다. 다시 요청해 주세요.');
  }
  if (verificationCodeMatches(code, record.codeHash)) return;

  // 실패도 기록해야 시도 횟수 제한이 작동한다 (PRD F-1.5)
  const updated = await emailVerifications().findOneAndUpdate(
    { _id: record._id },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after', projection: { attempts: 1 } },
  );
  const left = config.verification.maxAttempts - (updated?.attempts ?? config.verification.maxAttempts);
  throw new HttpError(
    400,
    'invalid_code',
    left > 0
      ? `인증번호가 일치하지 않습니다. (${left}회 남음)`
      : '시도 횟수를 초과했습니다. 다시 요청해 주세요.',
  );
}

/** 어드민이 전달할, 아직 쓰이지 않은 인증코드. 만료된 것은 제외한다. */
export async function pendingSignupCodes() {
  const docs = await emailVerifications()
    .find({ consumedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();

  const roster = await students()
    .find({ _id: { $in: docs.map((d) => d.studentNo) } }, { projection: { name: 1 } })
    .toArray();
  const nameById = new Map(roster.map((s) => [s._id, s.name]));

  return docs.map((d) => ({
    studentNo: d.studentNo,
    name: nameById.get(d.studentNo) ?? '',
    email: d.email,
    code: d.code ?? null,
    expiresAt: d.expiresAt,
  }));
}

/** 2단계 — 코드를 검증하고 계정을 만든다. */
export async function completeSignup(
  rawEmail: string,
  code: string,
  password: string,
): Promise<PublicUser> {
  const { email, studentNo } = parseSchoolEmail(rawEmail);

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, 
      'weak_password',
      `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
    );
  }

  // 어드민이 발급한 코드가 있으면 그걸로, 없으면 Supabase가 보낸 코드로 검증한다.
  const record = await emailVerifications().findOne(
    { studentNo, consumedAt: null },
    { sort: { createdAt: -1 } },
  );
  if (record) {
    await checkLocalCode(record, code);
  } else if (config.supabase) {
    await verifyOtp(email, code);
  } else {
    throw new HttpError(400, 'no_verification', '인증 요청을 먼저 해주세요.');
  }

  const student = await students().findOne({ _id: studentNo }, { projection: { name: 1 } });
  if (!student) {
    throw new HttpError(400, 'unknown_student', '등록되지 않은 학번입니다.');
  }

  const now = new Date();
  const user: UserDoc = {
    _id: studentNo,
    email,
    passwordHash: await hashPassword(password),
    points: config.auth.signupBonus,
    role: studentNo === config.auth.adminStudentNo ? 'admin' : 'user',
    createdAt: now,
    lastLoginAt: now,
  };

  try {
    await users().insertOne(user);
  } catch (err) {
    // unique 인덱스 충돌 — 동시 요청으로 이미 만들어진 경우
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw new HttpError(409, 'already_registered', '이미 가입된 학번입니다.');
    }
    throw err;
  }

  if (record) await emailVerifications().updateOne({ _id: record._id }, { $set: { consumedAt: now } });

  await pointTransactions().insertOne({
    _id: new ObjectId(),
    userId: studentNo,
    delta: config.auth.signupBonus,
    reason: 'signup_bonus',
    refId: null,
    grantedBy: null,
    memo: '가입 지급',
    balanceAfter: config.auth.signupBonus,
    createdAt: now,
  });

  return toPublicUser(user, student.name);
}

export async function login(rawEmail: string, password: string): Promise<PublicUser> {
  // 로그인 실패는 사유를 구분하지 않는다 — 계정 존재 여부가 새지 않게 한다.
  const failure = () =>
    new HttpError(401, 'invalid_credentials', '이메일 또는 비밀번호가 올바르지 않습니다.');

  let email: string;
  let studentNo: string;
  try {
    ({ email, studentNo } = parseSchoolEmail(rawEmail));
  } catch {
    throw failure();
  }

  const user = await users().findOne({ _id: studentNo, email });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw failure();
  }

  const now = new Date();
  await users().updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });

  const student = await students().findOne({ _id: studentNo }, { projection: { name: 1 } });
  return toPublicUser({ ...user, lastLoginAt: now }, student?.name ?? studentNo);
}

export async function getPublicUser(studentNo: string): Promise<PublicUser | null> {
  const user = await users().findOne({ _id: studentNo });
  if (!user) return null;

  const student = await students().findOne({ _id: studentNo }, { projection: { name: 1 } });
  return toPublicUser(user, student?.name ?? studentNo);
}

function toPublicUser(user: UserDoc, name: string): PublicUser {
  return {
    studentNo: user._id,
    name,
    email: user.email,
    points: user.points,
    role: user.role,
  };
}
