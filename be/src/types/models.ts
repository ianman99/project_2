import type { ObjectId } from 'mongodb';

export type UserRole = 'user' | 'admin';

/** _id는 학번 문자열. students._id와 같은 값이다. */
export interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  points: number;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface EmailVerificationDoc {
  _id: ObjectId;
  studentNo: string;
  email: string;
  /** 어드민이 직접 전달할 수 있게 평문도 보관한다 (PRD F-1.9). 만료 시 자동 삭제된다. */
  code: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export type PointReason =
  | 'signup_bonus'
  | 'match_initial'
  | 'match_refresh'
  | 'admin_grant'
  | 'pandora';

export interface PointTransactionDoc {
  _id: ObjectId;
  userId: string;
  delta: number;
  reason: PointReason;
  refId: ObjectId | null;
  grantedBy: string | null;
  memo: string | null;
  balanceAfter: number;
  createdAt: Date;
}

/** students 컬렉션에서 인증에 필요한 최소 필드만. */
export interface StudentDoc {
  _id: string;
  name: string;
  profile: { gender: string };
}

export interface MatchResult {
  candidateId: string;
  name: string;
  score: number;
  headline: string;
  reasons: string[];
  concerns: string[];
  conversationStarters: string[];
}

export interface MatchDoc {
  _id: ObjectId;
  userId: string;
  generatedAt: Date;
  isRefresh: boolean;
  model: string;
  /** 전원 저장하되 클라이언트에는 1위만 내려보낸다 (PRD Q3, S-8) */
  results: MatchResult[];
  /** 1위 상대와의 홍대 데이트 코스. 생성 실패 시 null. */
  dateCourse: DateCourse | null;
  usage: { inputTokens: number; outputTokens: number };
}

export interface DateCourseStop {
  time: string;
  place: string;
  address: string;
  activity: string;
  why: string;
}

export interface DateCourse {
  title: string;
  stops: DateCourseStop[];
  tips: string[];
}

export interface ProfileEditChange {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface ProfileEditRequestDoc {
  _id: ObjectId;
  userId: string;
  changes: ProfileEditChange[];
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export interface PointRequestDoc {
  _id: ObjectId;
  userId: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  grantedPoints: number | null;
}

/** 판도라의 상자 — 가장 안 맞는 상대. score는 재앙 지수(높을수록 최악). */
export interface PandoraResult {
  candidateId: string;
  name: string;
  score: number;
  headline: string;
  reasons: string[];
  disasterScene: string;
  survivalTips: string[];
}

export interface PandoraDoc {
  _id: ObjectId;
  userId: string;
  generatedAt: Date;
  isReopen: boolean;
  model: string;
  /** 재앙 지수 내림차순. 클라이언트에는 1위(최악)만 내려보낸다. */
  results: PandoraResult[];
  usage: { inputTokens: number; outputTokens: number };
}
