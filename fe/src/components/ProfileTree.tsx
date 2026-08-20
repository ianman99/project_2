/** 프로필 문서를 그대로 펼쳐 보여준다. 필드가 많고 중첩이 깊어 범용 렌더러로 처리한다. */

const LABELS: Record<string, string> = {
  _id: '학번',
  _type: '문서 유형',
  _schema_version: '스키마 버전',
  _snapshot_date: '기준일',
  id: '학번',
  name: '이름',
  english_name: '영어 이름',
  bio: '한 줄 소개',
  cohort: '기수 정보',
  program: '과정',
  batch: '기수',
  class: '반',
  student_no: '학번',
  bx_team_from_student_no: 'BX 팀 번호',
  profile: '기본 정보',
  gender: '성별',
  birth_date: '생년월일',
  birth_year: '출생연도',
  age_western: '만 나이',
  age_korean: '한국 나이',
  mbti: 'MBTI',
  mbti_note: 'MBTI 비고',
  mbti_axes: 'MBTI 축',
  energy: '에너지',
  perception: '인식',
  decision: '판단',
  lifestyle: '생활',
  blood_type: '혈액형',
  sibling_order: '형제 순서',
  school: '학교',
  major: '전공',
  major_field: '전공 계열',
  education_status: '학력 상태',
  residence: '거주지',
  raw: '원문',
  region: '지역',
  district: '시군구',
  cluster: '권역',
  last_train: '막차',
  hometown: '고향',
  phone: '전화번호',
  one_liner: '한마디',
  self_intro: '자기소개',
  career: '커리어',
  desired_job: '희망 직무',
  job_family: '직무 분류',
  job_note: '직무 비고',
  certifications: '자격증',
  certifications_note: '자격증 비고',
  experience: '경력',
  interests: '관심사',
  hobbies: '취미',
  likes: '좋아하는 것',
  dislikes: '싫어하는 것',
  music: '음악',
  genres: '장르',
  artists: '아티스트',
  sports: '스포츠',
  play: '직접 하는 것',
  watch: '관람',
  teams: '팀',
  games: '게임',
  travel: '여행',
  lived_abroad: '해외 거주',
  wish: '가보고 싶은 곳',
  note: '비고',
  pets: '반려동물',
  has: '여부',
  detail: '상세',
  categories: '분류',
  food: '음식',
  cannot_eat: '못 먹는 것',
  drinking: '음주',
  exercise: '운동',
  notes: '메모',
  tmi: 'TMI',
  qna: '질문과 답변',
  q: '질문',
  a: '답변',
  bx: '1차 팀 (BX)',
  cx: '2차 팀 (CX)',
  dx: '3차 팀 (DX)',
  phase: '단계',
  round: '회차',
  label: '이름',
  team_no: '팀 번호',
  team_name: '팀 이름',
  role: '역할',
  is_leader: '팀장 여부',
  leader: '팀장',
  teammates: '팀원',
  self_reported_in_this_round: '이때 직접 적은 것',
  matching: '매칭용 데이터',
  interest_keys: '관심 키워드',
  tags: '태그',
  social_energy: '사회적 에너지',
  region_cluster: '거주 권역',
  commute_constraint: '통근 제약',
  food_avoid: '기피 음식',
  food_love: '선호 음식',
  dealbreakers: '못 참는 것',
  conversation_starters: '대화 소재',
  leadership_rounds: '팀장 맡은 회차',
  leadership_count: '팀장 횟수',
  teamed_with: '같은 팀이었던 사람',
  teamed_with_ids: '같은 팀 학번',
  repeat_teammates: '두 번 이상 같은 팀',
  never_teamed_with_ids: '한 번도 안 만난 학번',
  never_teamed_with: '한 번도 같은 팀이 아니었던 사람',
  times: '횟수',
  phases: '회차',
  data_quality: '데이터 품질',
  missing_fields: '빠진 항목',
  needs_verification: '확인 필요',
};

const label = (key: string) => LABELS[key] ?? key;

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-indigo">—</span>;
  }
  if (typeof value === 'boolean') return <span>{value ? '예' : '아니오'}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-indigo">—</span>;
    // 원시값 배열은 한 줄로 합친다
    if (value.every((v) => v === null || typeof v !== 'object')) {
      return <span>{value.map(String).join(', ')}</span>;
    }
    return (
      <div className="mt-1 space-y-1">
        {value.map((item, i) => (
          <div key={i} className="border-l-2 border-chrome-indigo pl-2">
            <Fields obj={item as Record<string, unknown>} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="mt-1">
        <Fields obj={value as Record<string, unknown>} />
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function Fields({ obj }: { obj: Record<string, unknown> }) {
  return (
    <dl className="text-[12px] text-carbon">
      {Object.entries(obj).map(([key, value]) => (
        <div key={key} className="flex gap-2 py-0.5">
          <dt className="w-32 shrink-0 text-[11px] font-bold text-chrome-indigo">{label(key)}</dt>
          <dd className="min-w-0 flex-1 break-words">
            <Value value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 최상위 섹션 순서. 여기 없는 키는 뒤에 그대로 붙는다. */
const ORDER = [
  'name',
  'english_name',
  'bio',
  'profile',
  'career',
  'interests',
  'food',
  'lifestyle',
  'tmi',
  'qna',
  'cohort',
  'teams',
];

export function ProfileTree({ profile }: { profile: Record<string, unknown> }) {
  const keys = Object.keys(profile);
  const ordered = [...ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !ORDER.includes(k))];

  return (
    <div>
      {ordered.map((key) => {
        const value = profile[key];
        const isSection = value !== null && typeof value === 'object';
        return (
          <section key={key} className="mb-3">
            <p className="legend mb-1 text-chrome-indigo">{label(key)}</p>
            <div className="inset p-2">
              {isSection ? (
                <Value value={value} />
              ) : (
                <span className="text-[12px] text-carbon">
                  <Value value={value} />
                </span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
