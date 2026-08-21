# 배포 가이드

## 구조

Express 한 대가 API와 프론트 정적 파일을 함께 서빙한다. 서버 하나, 도메인 하나, 인증서 하나로 끝난다.

```
https://your-domain/            → fe/dist/index.html (SPA)
https://your-domain/assets/*    → fe/dist/assets/* (1년 캐시)
https://your-domain/api/*       → Express API
https://your-domain/health      → 헬스체크 (플랫폼용)
```

프론트와 API가 같은 오리진이라 **CORS 설정도, 크로스사이트 쿠키 문제도 없다.**

## 빌드

```bash
cd fe && npm ci && npm run build     # → fe/dist
cd ../be && npm ci && npm run build  # → be/dist
```

## 실행

```bash
cd be
NODE_ENV=production STATIC_DIR=../fe/dist node dist/index.js
```

`STATIC_DIR`을 지정하지 않으면 API만 서빙한다(개발 모드와 동일).

## 환경변수

`be/.env` 또는 플랫폼의 환경변수 설정에 넣는다. `.env.example`을 참고할 것.

| 변수 | 배포 시 값 | 비고 |
|---|---|---|
| `NODE_ENV` | `production` | **쿠키 `secure` 플래그가 여기 연동됨. HTTPS 필수** |
| `PORT` | 플랫폼이 주입하는 값 | 기본 4000 |
| `STATIC_DIR` | `../fe/dist` | 프론트 서빙 활성화 |
| `CORS_ORIGIN` | 통합 서빙이면 불필요 | 프론트를 따로 띄울 때만 |
| `SESSION_SECRET` | 새로 생성 | `openssl rand -hex 32` |
| `MONGODB_URI` | Atlas 커넥션 스트링 | 아래 주의사항 참조 |
| `MONGODB_DB` | `dxschool` | |
| `RESEND_API_KEY` | Resend API 키 | **Render에서는 필수** — 아래 참조 |
| `MAIL_FROM_ADDRESS` | `noreply@dxschool.co.kr` | Resend에 인증된 도메인이어야 한다 |
| `MAIL_FROM_NAME` | `사랑찾아 인생찾아` | |
| `SMTP_*` | 설정하지 않음 | `RESEND_API_KEY`가 있으면 무시된다 |
| `OPENAI_API_KEY` | OpenAI 키 | |
| `OPENAI_MODEL` | `gpt-5.6-terra` | |
| `ADMIN_STUDENT_NO` | `6155` | |
| `MATCH_COST` | `1000` | |

## 배포 전 체크리스트

### 반드시 할 것

- [ ] **HTTPS 적용.** `NODE_ENV=production`이면 세션 쿠키에 `secure` 플래그가 붙는다. HTTP로 서비스하면 쿠키가 저장되지 않아 **로그인이 아예 안 된다.**
- [ ] **Atlas Network Access에 서버 IP 추가.** 현재는 개발 PC IP만 등록돼 있다. 서버에서 접속하려면 그 IP를 추가해야 한다. PaaS처럼 IP가 유동이면 `0.0.0.0/0`을 열되 DB 비밀번호를 충분히 강하게 둘 것.
- [ ] **`MONGODB_URI`를 SRV 형식으로 교체.** 개발 PC의 DNS 문제 때문에 지금은 샤드 호스트를 직접 나열한 표준 스트링을 쓰고 있다. 서버에서는 SRV가 정상 동작하며, Atlas가 호스트를 재배치해도 자동으로 따라간다.
  ```
  mongodb+srv://<user>:<pass>@dxschool.xdzyytn.mongodb.net/dxschool?retryWrites=true&w=majority
  ```
- [ ] **`SESSION_SECRET` 새로 생성.** 개발용 값을 그대로 쓰면 안 된다.
- [ ] **비밀번호 3종 재발급** — Atlas DB, 네이버 앱 비밀번호, OpenAI API 키. 개발 중 대화에 노출된 값들이다.
- [ ] **`.env`가 저장소에 없는지 확인.** `git ls-files | grep .env` 결과가 비어 있어야 한다.

### 확인할 것

- [ ] 배포 서버에서 실제로 인증 메일이 도착하는지 (회원가입 1단계를 직접 눌러 확인)
- [ ] Resend 무료 한도 — 월 3,000통 / 일 100통. 24명 규모면 문제없음
- [ ] 첫 요청 시 인덱스가 자동 생성됨 (`ensureIndexes`) — 별도 마이그레이션 불필요

## 메일 발송 — Render에서는 SMTP를 쓸 수 없다

Render 무료 플랜은 **아웃바운드 SMTP 포트(25·465·587)를 차단**한다(2025-09-26 시행).
네이버 SMTP로 보내면 `ETIMEDOUT / command: 'CONN'`으로 실패한다. 코드나 계정 문제가 아니다.
포트 25는 유료 플랜에서도 영구 차단이다.

그래서 `RESEND_API_KEY`가 설정돼 있으면 SMTP 대신 **Resend HTTP API(443)** 로 보낸다.
설정이 없으면 기존 네이버 SMTP를 그대로 쓰므로 로컬 개발은 바뀌지 않는다.

설정 순서:

1. [resend.com](https://resend.com) 가입 (무료: 월 3,000통, 일 100통)
2. **Domains → Add Domain**에 `dxschool.co.kr` 등록
3. Resend가 알려주는 DNS 레코드(TXT/MX 계열)를 `dxschool.co.kr` DNS에 추가하고 인증 완료를 기다린다
   - 기존 수신 설정은 건드리지 않는다. 발송용 레코드만 추가된다.
4. **API Keys → Create API Key** (권한은 `Sending access`면 충분)
5. Render 환경변수에 추가
   - `RESEND_API_KEY=re_...`
   - `MAIL_FROM_ADDRESS=noreply@dxschool.co.kr` ← **반드시 인증한 도메인의 주소로 바꾼다.**
     네이버 주소를 그대로 두면 Resend가 403으로 거부한다.
6. 재배포 후 회원가입 1단계를 눌러 메일 도착 확인

## 플랫폼별 메모

**Render / Railway / Fly.io**
- 빌드: `cd fe && npm ci && npm run build && cd ../be && npm ci && npm run build`
- 시작: `cd be && node dist/index.js`
- 헬스체크 경로: `/health`
- HTTPS와 프록시는 플랫폼이 처리한다. `trust proxy`가 이미 켜져 있다.

**VPS 직접 운영**
- Nginx나 Caddy를 앞에 두고 TLS를 종료시킨다.
- `pm2`나 systemd로 프로세스를 관리한다.
- 프록시를 안 쓰고 직접 노출한다면 `app.set('trust proxy', 1)`을 꺼야 한다 (클라이언트 IP 위조 방지).

## 운영 중 참고

**AI 비용** — 매칭 1회에 입력 약 67,000 / 출력 약 8,000 토큰이 든다. 웹 검색 결과가 컨텍스트에 통째로 들어가기 때문이다. 줄이려면 `matching.service.ts`의 `search_context_size`를 `'low'`로 낮춘다.

**매칭 소요 시간** — AI 호출이 3번(매칭 → 웹 검색 → 코스 구성) 순차로 일어나 1~2분 걸린다. 플랫폼의 요청 타임아웃이 이보다 짧으면 매칭이 실패한다. Render 등은 기본 타임아웃이 넉넉하지만 확인이 필요하다.

**포인트 지급** — 어드민 화면에서 처리한다. CLI가 필요하면 `npx tsx scripts/grant.ts <학번> <금액> "사유"`.

**세션** — MongoDB `sessions` 컬렉션에 저장된다. 전원 강제 로그아웃은 이 컬렉션을 비우면 된다.
