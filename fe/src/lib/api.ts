const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export type Role = 'user' | 'admin';

export interface User {
  studentNo: string;
  name: string;
  email: string;
  points: number;
  role: Role;
}

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError('network', '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.');
  }
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.code ?? 'unknown', err?.message ?? '요청에 실패했습니다.');
  }
  return body as T;
}

const post = <T,>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) });

export type PointReason = 'signup_bonus' | 'match_initial' | 'match_refresh' | 'admin_grant';

export interface PointTransaction {
  id: string;
  delta: number;
  reason: PointReason;
  memo: string | null;
  balanceAfter: number;
  createdAt: string;
}

export const REASON_LABEL: Record<PointReason, string> = {
  signup_bonus: '가입 지급',
  match_initial: '운명의 상대 찾기',
  match_refresh: '운명의 상대 새로고침',
  admin_grant: '어드민 지급',
};

export interface DateCourse {
  title: string;
  stops: { time: string; place: string; address: string; activity: string; why: string }[];
  tips: string[];
}

export interface MatchResult {
  id: string;
  generatedAt: string;
  isRefresh: boolean;
  dateCourse: DateCourse | null;
  match: {
    name: string;
    score: number;
    headline: string;
    reasons: string[];
    concerns: string[];
    conversationStarters: string[];
  };
}

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  points: () => request<{ points: number; transactions: PointTransaction[] }>('/points'),
  latestMatch: () => request<{ cost: number; result: MatchResult | null }>('/matches'),
  matchHistory: () => request<{ items: MatchResult[] }>('/matches/history'),
  fullProfile: () => request<{ profile: Record<string, unknown> }>('/profile'),
  runMatch: () => post<{ result: MatchResult }>('/matches'),
  requestCode: (email: string) => post<{ expiresInMinutes: number }>('/auth/signup/request', { email }),
  verifySignup: (email: string, code: string, password: string) =>
    post<{ user: User }>('/auth/signup/verify', { email, code, password }),
  login: (email: string, password: string) => post<{ user: User }>('/auth/login', { email, password }),
  logout: () => post<{ ok: true }>('/auth/logout'),
};
