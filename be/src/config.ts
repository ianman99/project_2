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
  },
  mongo: {
    uri: required('MONGODB_URI'),
    db: required('MONGODB_DB'),
  },
  smtp: {
    host: required('SMTP_HOST'),
    port: Number(required('SMTP_PORT')),
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
  },
  mail: {
    fromAddress: required('MAIL_FROM_ADDRESS'),
    fromName: optional('MAIL_FROM_NAME', '사랑찾아 인생찾아'),
  },
  auth: {
    sessionSecret: required('SESSION_SECRET'),
    adminStudentNo: optional('ADMIN_STUDENT_NO', '6155'),
    /** 가입 시 지급 포인트 (PRD F-5.1) */
    signupBonus: 5000,
  },
  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: optional('OPENAI_MODEL', 'gpt-4o-mini'),
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
