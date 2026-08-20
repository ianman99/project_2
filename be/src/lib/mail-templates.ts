/**
 * 메일 템플릿. 메일 클라이언트 호환을 위해 table 레이아웃 + 인라인 스타일만 쓴다.
 * 색은 DESIGN.md 팔레트를 따르되, 각진 모서리(border-radius 0) 원칙을 유지한다.
 */

const COLORS = {
  carbon: '#21242e',
  canvas: '#7a8aba',
  chromeIndigo: '#3d4f97',
  amber: '#ecab37',
  surface: '#ffffff',
  ink: '#21242e',
} as const;

const SERVICE_NAME = '사랑찾아 인생찾아';

export interface VerificationMail {
  subject: string;
  html: string;
  text: string;
}

export function buildVerificationMail(code: string, expiresInMinutes: number): VerificationMail {
  const subject = `[${SERVICE_NAME}] 인증번호 ${code}`;

  const text = [
    `${SERVICE_NAME} 회원가입 인증번호입니다.`,
    '',
    `인증번호: ${code}`,
    '',
    `이 번호는 ${expiresInMinutes}분 후 만료됩니다.`,
    '본인이 요청하지 않았다면 이 메일을 무시하세요.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="ko">
<body style="margin:0;padding:24px;background:${COLORS.canvas};font-family:Arial,'맑은 고딕',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="background:${COLORS.carbon};padding:14px 20px;">
        <span style="color:${COLORS.amber};font-size:13px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;">${SERVICE_NAME}</span>
      </td>
    </tr>
    <tr>
      <td style="background:${COLORS.surface};border-top:2px solid ${COLORS.chromeIndigo};padding:28px 20px;">
        <p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:${COLORS.ink};">
          회원가입을 마치려면 아래 인증번호를 입력하세요.
        </p>
        <div style="background:${COLORS.carbon};padding:18px;text-align:center;">
          <span style="color:${COLORS.amber};font-size:32px;font-weight:900;letter-spacing:8px;font-family:Arial Black,Arial,sans-serif;">${code}</span>
        </div>
        <p style="margin:20px 0 0;font-size:11px;line-height:1.5;color:${COLORS.chromeIndigo};">
          이 번호는 <strong>${expiresInMinutes}분</strong> 후 만료됩니다.<br>
          본인이 요청하지 않았다면 이 메일을 무시하세요.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:${COLORS.carbon};padding:10px 20px;">
        <span style="color:${COLORS.canvas};font-size:10px;">LG전자 DX SCHOOL 6기 1반 전용 서비스</span>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
