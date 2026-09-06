# 배포

Supabase 프로젝트와 Vercel 프로젝트 **생성 자체는 계정 로그인이 필요해 코드로 대신할 수 없다.**
아래는 그 두 가지를 만든 뒤 이 저장소를 붙이는 순서다. 처음부터 끝까지 20분쯤 걸린다.

---

## 1. Supabase

### 1.1 프로젝트 생성

<https://supabase.com/dashboard> → New project

| 항목 | 값 |
|---|---|
| Region | **Northeast Asia (Seoul) `ap-northeast-2`** |
| Database Password | 생성 후 다시 볼 수 없다. 바로 비밀번호 관리자에 넣을 것 |

리전은 Vercel 함수 리전(`vercel.json` 의 `icn1`)과 맞춘다. 둘이 대륙을 넘어가면
글 목록 쿼리 한 번마다 왕복 지연이 그대로 붙는다.

> **착수 전 확인 (기획안 §2.2).** 무료 티어는 일정 기간 요청이 없는 프로젝트를
> 일시정지한다. 트래픽이 없는 초기에는 이 정책이 실제로 사이트를 멈출 수 있으니
> 현재 약관을 직접 확인할 것. 멈추면 대시보드에서 수동 재개해야 한다.

### 1.2 스키마 적용

**A. 대시보드 (가장 간단)**

SQL Editor → New query → `supabase/migrations/20260906000000_init.sql` 전체를
붙여넣고 Run.

**B. CLI (이후 마이그레이션을 쌓을 거라면 이쪽)**

```bash
npm i -g supabase
supabase login
supabase link --project-ref <프로젝트 ref>   # 대시보드 URL 에 있는 문자열
supabase db push
```

`supabase/config.toml` 의 `major_version` 이 실제 프로젝트의 Postgres 버전과
다르면 `db diff` 가 어긋난다. Settings → Database 에서 확인하고 맞출 것.

### 1.3 관리자 계정과 profile

M1 은 인증이 없지만 `posts.author_id` 가 not null 이고 `profiles → auth.users` 를
참조한다. **auth 유저가 0명이면 글을 한 건도 넣을 수 없다.**

1. Authentication → Users → **Add user** → Create new user
   (이메일 아무거나. Auto Confirm User 체크)
2. 생성된 행의 **UID** 를 복사
3. SQL Editor 에서 `supabase/seed.sql` 을 열어 UUID 자리를 그 값으로 바꾸고 Run

이 계정은 M2 에서 매직링크가 붙으면 그대로 정상 로그인 계정이 된다.

### 1.4 RLS 확인

마이그레이션이 네 테이블 전부에 RLS 를 켜고 정책을 만든다. 적용 후
Table Editor 에서 각 테이블에 **RLS enabled** 배지가 붙었는지 눈으로 볼 것.
하나라도 꺼져 있으면 anon 키만으로 누구나 쓸 수 있다(기획안 §5.3, §7).

그 다음 **정책 우회 테스트를 돌린다.** 기획안 §6 M2 의 완료 기준이다.

```bash
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:rls
```

계정 두 개를 만들어 남의 글 수정·삭제, 남의 초안 열람, 남의 이름으로 글쓰기,
비로그인 좋아요 삽입, 스스로 관리자 되기를 차례로 시도하고 전부 막히는지 본다.
끝나면 만든 계정을 지운다. **개발용 프로젝트에서 돌릴 것** — 운영 DB 에 테스트
계정과 글이 잠깐 생긴다.

전부 통과해야 다음 단계로 넘어간다. 실패한 항목은 실제 구멍이다.

### 1.5 인증 설정 (M2)

Authentication → URL Configuration

| 항목 | 값 |
|---|---|
| Site URL | 배포 도메인 (예: `https://eonjenga.vercel.app`) |
| Redirect URLs | `https://<도메인>/auth/callback`, `http://localhost:3000/auth/callback` |

**여기가 첫 배포에서 가장 자주 막히는 곳이다.** Redirect URL 목록에 없는 주소로는
Supabase 가 되돌려 보내지 않는다. 로컬 주소를 같이 넣어두지 않으면 개발 중에
로그인이 안 되고, 배포 도메인을 안 넣으면 운영에서 안 된다.

Vercel 의 프리뷰 배포까지 쓰려면 와일드카드를 하나 더 넣는다:
`https://*-<팀명>.vercel.app/auth/callback`

Authentication → Providers → Email 에서 **Confirm email** 이 켜져 있는지 확인한다.
매직링크는 이 설정을 쓴다. 비밀번호 로그인은 쓰지 않으므로 꺼도 된다.

### 1.6 키 복사

Settings → API 에서 세 값을 가져온다.

| 대시보드 이름 | 환경변수 |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

`service_role` 에는 **절대 `NEXT_PUBLIC_` 을 붙이지 않는다.** 붙이면 클라이언트
번들에 그대로 들어가고 RLS 가 무의미해진다. `next.config.mjs` 가 빌드에서
이 실수를 잡지만, 이름을 처음부터 맞추는 편이 낫다.

---

## 2. 로컬에서 먼저 확인

```bash
cp .env.example .env.local   # 위에서 모은 값 + ADMIN_PASSWORD, ADMIN_AUTHOR_ID
npm install
npm run dev
```

1. <http://localhost:3000/write> → 관리자 비밀번호 입력
2. 제목·부제·카테고리·본문을 넣고 **발행**
3. 홈에 뜨는지, 새로고침해도 남아 있는지 확인
4. **썸네일 URL 을 비운 채로 한 건 더 발행** — 카드가 성립하는지 확인
   (기획안 §1 의 전제 조건)
5. <http://localhost:3000/feed.xml> 에 두 글이 들어왔는지 확인

여기까지 되면 배포해도 된다. 안 되는 걸 배포하면 원인이 두 배로 늘어난다.

---

## 3. Vercel

### 3.1 프로젝트 연결

<https://vercel.com/new> → GitHub 저장소 `mins0o0ng/webmagazine` 임포트.

| 항목 | 값 |
|---|---|
| Framework Preset | Next.js (자동 감지) |
| Root Directory | `./` |
| Build / Install Command | 기본값 그대로 |
| Production Branch | 아래 참고 |

Production Branch 는 기본이 `main` 인데 **이 저장소에는 아직 `main` 이 없다.**
지금 브랜치는 `claude/web-magazine-github-6fdyvl` 이므로 둘 중 하나를 한다.

- 이 브랜치를 `main` 으로 병합한 뒤 기본값으로 둔다 (권장)
- 또는 Settings → Git → Production Branch 를 현재 브랜치로 지정한다

### 3.2 환경변수

Settings → Environment Variables 에 다섯 개를 넣는다.
Production / Preview / Development 세 환경 모두 체크.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      ← Sensitive 로 표시
ADMIN_PASSWORD                 ← Sensitive 로 표시
ADMIN_AUTHOR_ID
NEXT_PUBLIC_SITE_URL           ← 배포 후 실제 도메인. 처음엔 비워두고 3.3 에서 채운다
```

하나라도 빠지면 **빌드가 실패한다.** 배포된 다음 첫 방문자의 요청에서 500 으로
죽는 것보다 낫기 때문에 일부러 그렇게 해두었다 (`lib/env.mjs`).

### 3.3 도메인 확정 후

`NEXT_PUBLIC_SITE_URL` 은 RSS 의 `<link>` 와 og:image 절대 경로에 쓰인다.
비어 있으면 `http://localhost:3000` 으로 폴백하므로 **배포된 RSS 가 로컬 주소를
가리킨다.** 도메인이 정해지면 값을 채우고 **재배포**할 것 (환경변수 변경은
자동 재배포되지 않는다).

### 3.4 리전

`vercel.json` 이 서버리스 함수 리전을 `icn1`(서울)로 고정한다. Supabase 를
서울에 만들었다면 그대로 두고, 다른 리전에 만들었다면 이 값을 맞춰 바꾼다.
Hobby 플랜은 리전을 하나만 지정할 수 있다.

---

## 4. 배포 후 점검

- [ ] 홈이 뜨고 글이 보인다
- [ ] `/write` 가 비밀번호를 묻는다
- [ ] 배포 주소에서 글을 발행하면 홈에 반영된다 (온디맨드 무효화)
- [ ] `/feed.xml` 의 `<link>` 가 로컬 주소가 아니다
- [ ] `/p/999999` 가 404 다
- [ ] **빌드 산출물에 service_role 키가 없다:**
      Vercel 배포의 Source 탭에서 `.next/static` 을 키 앞 8자로 검색해 0건인지 확인
      (기획안 §7 의 '높음' 리스크)

---

## 아직 없는 것

- `main` 브랜치 — 위 3.1 참고
- 커스텀 도메인
- CI — 지금은 Vercel 빌드가 사실상 유일한 검사다. `npm run typecheck` 를
  PR 에서 돌리는 워크플로가 있으면 좋지만 아직 없다.
