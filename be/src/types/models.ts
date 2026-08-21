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

/** 글을 쓸 때 한 번만 정한다. 나중에 바꿀 수 없다. '공지'는 목록 맨 위에 고정된다. */
export const POST_CATEGORIES = ['공지', '일반'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export interface PollOptionDoc {
  id: string;
  label: string;
}

export interface PollDoc {
  options: PollOptionDoc[];
  /** 학번 → 선택한 옵션 id. 한 사람 한 표이고 다시 누르면 취소된다. */
  votes: Record<string, string>;
}

export interface CommentDoc {
  _id: ObjectId;
  userId: string;
  name: string;
  body: string;
  createdAt: Date;
}

/** 커뮤니티 글. 상세 페이지 없이 목록에서 바로 읽고 쓴다. */
export interface PostDoc {
  _id: ObjectId;
  userId: string;
  /** 작성 시점 이름을 그대로 박아둔다 — 읽을 때마다 students를 조회할 이유가 없다. */
  name: string;
  body: string;
  createdAt: Date;
  /**
   * 댓글은 글 안에 넣는다. 목록 한 번에 같이 내려가고, 글을 지우면 같이 사라진다.
   * 24명짜리 반이라 배열이 커질 일이 없다.
   */
  comments: CommentDoc[];
  /** 작성 시 확정된다. '공지'는 어드민만 지정할 수 있다. */
  category: PostCategory;
  poll: PollDoc | null;
}
