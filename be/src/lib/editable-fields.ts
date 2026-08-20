/**
 * 사용자가 수정 요청할 수 있는 필드. 이 목록에 없는 경로는 거부한다.
 * gender, teams, matching, cohort 등은 매칭 근거이자 사실 기록이라 임의 수정을 막는다.
 */
export interface EditableField {
  path: string;
  label: string;
  type: 'text' | 'textarea' | 'list';
  hint?: string;
}

export const EDITABLE_FIELDS: EditableField[] = [
  { path: 'profile.mbti', label: 'MBTI', type: 'text', hint: '예: ISTJ' },
  { path: 'profile.phone', label: '전화번호', type: 'text', hint: '예: 010-1234-5678' },
  { path: 'profile.residence.raw', label: '거주지', type: 'text', hint: '예: 경기 고양시' },
  { path: 'profile.one_liner', label: '한마디', type: 'text' },
  { path: 'profile.self_intro', label: '자기소개', type: 'textarea' },
  { path: 'career.desired_job', label: '희망 직무', type: 'list' },
  { path: 'career.job_family', label: '직무 분류', type: 'text' },
  { path: 'interests.hobbies', label: '취미', type: 'list' },
  { path: 'interests.likes', label: '좋아하는 것', type: 'list' },
  { path: 'interests.dislikes', label: '싫어하는 것', type: 'list' },
  { path: 'food.likes', label: '좋아하는 음식', type: 'list' },
  { path: 'food.cannot_eat', label: '못 먹는 음식', type: 'list' },
  { path: 'food.note', label: '음식 관련 메모', type: 'text' },
  { path: 'lifestyle.notes', label: '생활 메모', type: 'list' },
  { path: 'tmi', label: 'TMI', type: 'list' },
];

const BY_PATH = new Map(EDITABLE_FIELDS.map((f) => [f.path, f]));

export const findField = (path: string) => BY_PATH.get(path);

/** 점 표기 경로로 중첩 객체에서 값을 꺼낸다. */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? acc : acc[key]), obj);
}
