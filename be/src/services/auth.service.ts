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
import { sendMail } from '../lib/mailer';
import { buildVerificationMail } from '../lib/mail-templates';
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

  return { expiresInMinutes: config.verification.expiresInMinutes, delivery: await deliver(email, code) };
}

/**
 * 메일이 설정돼 있으면 보내고, 없거나 실패하면 어드민 발급으로 넘긴다 (PRD F-1.9).
 * 발송이 안 됐다고 가입 자체를 막지는 않는다 — 코드는 이미 만들어져 있고
 * 어드민이 화면에서 읽어 전달할 수 있다.
 */
let mailBroken = false;

async function deliver(email: string, code: string): Promise<CodeDelivery> {
  if (!config.mail.enabled || mailBroken) return 'admin';
  try {
    await sendMail({ to: email, ...buildVerificationMail(code, config.verification.expiresInMinutes) });
    return 'email';
  } catch (err) {
    // 한 번 막히면 대개 계속 막힌다(포트 차단 등). 매 가입마다 10초씩 끌지 않도록 한 번만 시도한다.
    mailBroken = true;
    console.error('[mail] 인증코드 발송 실패 — 이후 어드민 발급으로 전환:', err);
    return 'admin';
  }
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

  const record = await emailVerifications().findOne(
    { studentNo, consumedAt: null },
    { sort: { createdAt: -1 } },
  );
  if (!record) {
    throw new HttpError(400, 'no_verification', '인증 요청을 먼저 해주세요.');
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(400, 'code_expired', '인증번호가 만료되었습니다. 다시 요청해 주세요.');
  }
  if (record.attempts >= config.verification.maxAttempts) {
    throw new HttpError(400, 'too_many_attempts', '시도 횟수를 초과했습니다. 다시 요청해 주세요.');
  }

  if (!verificationCodeMatches(code, record.codeHash)) {
    // 실패도 기록해야 시도 횟수 제한이 작동한다 (PRD F-1.5)
    const updated = await emailVerifications().findOneAndUpdate(
      { _id: record._id },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after', projection: { attempts: 1 } },
    );
    const left = config.verification.maxAttempts - (updated?.attempts ?? config.verification.maxAttempts);
    throw new HttpError(400, 
      'invalid_code',
      left > 0 ? `인증번호가 일치하지 않습니다. (${left}회 남음)` : '시도 횟수를 초과했습니다. 다시 요청해 주세요.',
    );
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

  await emailVerifications().updateOne({ _id: record._id }, { $set: { consumedAt: now } });

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
