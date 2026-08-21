import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}가 설정되지 않았습니다. be/.env를 확인하세요.`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const nodeEnv = optional('NODE_ENV', 'development');

/**
 * 인증코드 발송은 Supabase Auth에 맡긴다 (연결된 네이버 SMTP가 실제로 보낸다).
 * 설정이 없으면 발송하지 않고 어드민이 코드를 직접 발급한다 (PRD F-1.9).
 * secret 키는 쓰지 않는다 — otp/verify는 publishable 키로 충분하다.
 */
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
    ? {
        url: process.env.SUPABASE_URL.replace(/\/$/, ''),
        key: process.env.SUPABASE_PUBLISHABLE_KEY,
      }
    : null;

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  server: {
    port: Number(optional('PORT', '4000')),
    // 쉼표로 여러 오리진을 허용한다.
    corsOrigins: optional('CORS_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    /** 프론트 빌드본 경로. 지정하면 같은 서버에서 서빙한다 (배포용). */
    staticDir: process.env.STATIC_DIR ?? null,
  },
  mongo: {
    uri: required('MONGODB_URI'),
    db: required('MONGODB_DB'),
  },
  supabase,
  auth: {
    sessionSecret: required('SESSION_SECRET'),
    adminStudentNo: optional('ADMIN_STUDENT_NO', '6155'),
    /** 가입 시 지급 포인트 (PRD F-5.1) */
    signupBonus: 5000,
  },
  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: optional('OPENAI_MODEL', 'gpt-5.6-terra'),
  },
  match: {
    /** 최초 매칭·새로고침 모두 동일 비용 (PRD F-5.2) */
    cost: Number(optional('MATCH_COST', '1000')),
  },
  verification: {
    /** 학교 이메일 도메인 — 이 값 외에는 전부 거부한다 (PRD F-1.1) */
    emailDomain: 'dxschool.co.kr',
    codeLength: 6,
    expiresInMinutes: 10,
    maxAttempts: 5,
    resendCooldownSeconds: 60,
  },
} as const;
