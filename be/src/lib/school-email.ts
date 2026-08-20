import { config } from '../config';
import { HttpError } from './http-error';

const STUDENT_NO_PATTERN = /^\d{4}$/;

/**
 * 학교 이메일에서 학번을 뽑는다. 형식만 검사하며, 실제 명단 대조는 호출측이 한다.
 * 도메인은 config.verification.emailDomain과 정확히 일치해야 한다 (PRD F-1.1).
 */
export function parseSchoolEmail(rawEmail: string): { email: string; studentNo: string } {
  const email = rawEmail.trim().toLowerCase();
  const parts = email.split('@');

  if (parts.length !== 2) {
    throw new HttpError(400, 'invalid_email', '이메일 형식이 올바르지 않습니다.');
  }

  const [localPart, domain] = parts;

  if (domain !== config.verification.emailDomain) {
    throw new HttpError(400, 
      'invalid_domain',
      `@${config.verification.emailDomain} 이메일로만 가입할 수 있습니다.`,
    );
  }

  if (!STUDENT_NO_PATTERN.test(localPart)) {
    throw new HttpError(400, 'invalid_student_no', '이메일 앞부분은 4자리 학번이어야 합니다.');
  }

  return { email, studentNo: localPart };
}
