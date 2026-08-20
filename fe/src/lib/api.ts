// 배포에서는 같은 오리진이라 빈 문자열, 개발에서는 백엔드 포트를 가리킨다.
const HOST = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';
const BASE = `${HOST}/api`;

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

export interface EditableField {
  path: string;
  label: string;
  type: 'text' | 'textarea' | 'list';
  hint?: string;
  value: string | string[] | null;
}

export interface EditChange {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface EditRequest {
  id: string;
  userId: string;
  userName?: string;
  changes: EditChange[];
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt: string | null;
}

export const EDIT_STATUS_LABEL: Record<EditRequest['status'], string> = {
  pending: '검토 중',
  approved: '반영됨',
  rejected: '거절됨',
};

export interface PointRequest {
  id: string;
  userId: string;
  userName?: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt: string | null;
  grantedPoints: number | null;
}

export interface Balance {
  userId: string;
  name: string;
  points: number;
  role: Role;
}

export const POINT_STATUS_LABEL: Record<PointRequest['status'], string> = {
  pending: '검토 중',
  approved: '지급됨',
  rejected: '거절됨',
};

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  points: () => request<{ points: number; transactions: PointTransaction[] }>('/points'),
  latestMatch: () => request<{ cost: number; result: MatchResult | null }>('/matches'),
  matchHistory: () => request<{ items: MatchResult[] }>('/matches/history'),
  fullProfile: () => request<{ profile: Record<string, unknown> }>('/profile'),
  editable: () => request<{ fields: EditableField[]; pending: EditRequest | null }>('/profile/editable'),
  myEditRequests: () => request<{ items: EditRequest[] }>('/profile/edit-requests'),
  myPointRequests: () => request<{ items: PointRequest[] }>('/points/requests'),
  requestPoints: (message: string) => post<{ request: PointRequest }>('/points/request', { message }),
  pointRequests: () => request<{ items: PointRequest[] }>('/admin/point-requests'),
  approvePoints: (id: string, amount: number) =>
    post<{ request: PointRequest }>(`/admin/point-requests/${id}/approve`, { amount }),
  rejectPoints: (id: string) => post<{ request: PointRequest }>(`/admin/point-requests/${id}/reject`),
  grantPoints: (userId: string, amount: number, memo: string) =>
    post<{ userId: string; balance: number }>('/admin/grant', { userId, amount, memo }),
  balances: () => request<{ items: Balance[] }>('/admin/balances'),
  submitEdit: (changes: Record<string, string>) =>
    post<{ request: EditRequest }>('/profile/edit-request', changes),
  editRequests: (status = 'pending') =>
    request<{ items: EditRequest[] }>(`/admin/edit-requests?status=${status}`),
  approveEdit: (id: string) => post<{ request: EditRequest }>(`/admin/edit-requests/${id}/approve`),
  rejectEdit: (id: string) => post<{ request: EditRequest }>(`/admin/edit-requests/${id}/reject`),
  runMatch: () => post<{ result: MatchResult }>('/matches'),
  generateDateCourse: () => post<{ result: MatchResult }>('/matches/date-course'),
  requestCode: (email: string) => post<{ expiresInMinutes: number }>('/auth/signup/request', { email }),
  verifySignup: (email: string, code: string, password: string) =>
    post<{ user: User }>('/auth/signup/verify', { email, code, password }),
  login: (email: string, password: string) => post<{ user: User }>('/auth/login', { email, password }),
  logout: () => post<{ ok: true }>('/auth/logout'),
};
