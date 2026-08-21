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
 * 메일 발송은 선택사항이다.
 * 둘 다 없으면 인증코드를 발송하지 않고 어드민이 직접 발급한다 (PRD F-1.9).
 * 배포 환경이 이 경우다 — Render 무료 플랜은 SMTP 포트를 막고,
 * 학교 도메인은 DNS를 건드릴 수 없어 제3자 발송 API도 인증할 수 없다.
 */
const brevoApiKey = process.env.BREVO_API_KEY ?? null;
const smtp =
  !brevoApiKey && process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(optional('SMTP_PORT', '587')),
        user: optional('SMTP_USER', ''),
        pass: optional('SMTP_PASS', ''),
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
  smtp,
  mail: {
    fromAddress: optional('MAIL_FROM_ADDRESS', ''),
    fromName: optional('MAIL_FROM_NAME', '사랑찾아 인생찾아'),
    brevoApiKey,
    /** 발송 수단이 하나도 없으면 어드민이 코드를 직접 발급한다. */
    enabled: Boolean(brevoApiKey || smtp),
  },
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
