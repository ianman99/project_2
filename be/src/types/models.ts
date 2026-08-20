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
  /** 평문 저장 금지 (PRD F-1.8) */
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export type PointReason = 'signup_bonus' | 'match_initial' | 'match_refresh' | 'admin_grant';

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
