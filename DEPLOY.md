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

```bash
npm run db:migrate           # 안 돌린 것만, 이름 순서대로
npm run db:migrate -- --dry  # 무엇이 돌아갈지만 본다
```

`.env.local` 에 값 **두 개**가 있어야 한다.

```
DATABASE_URL=          # Connect → Session pooler 문자열을 그대로. [YOUR-PASSWORD] 그대로 둔다
SUPABASE_DB_PASSWORD=  # 데이터베이스 비밀번호 원문. 인코딩하지 않는다
```

비밀번호를 URL 안에 직접 넣지 않는 이유: Supabase 는 비밀번호에 특수문자를
요구하는데, 그 글자들이 URL 문법과 충돌한다 — `@` 는 호스트 구분자, `:` 는 포트,
`/` 는 경로, `#` 은 프래그먼트다. 사람에게 `%40` 으로 바꿔 적으라고 시키는 건
실패하는 절차라서, 인코딩은 `scripts/db-url.mjs` 가 한 곳에서 한다.
직접 조립한 URL 도 그대로 동작한다(`SUPABASE_DB_PASSWORD` 를 비워 두면 된다).

service_role 키로는 안 된다. 그 키는 PostgREST 를 통과하므로 테이블만 다루고
DDL 은 못 돌린다. 이 값은 마이그레이션 실행기 전용이라 **Vercel 에는 넣지 않는다.**

**이미 만들어진 프로젝트라면** — M1·M2 를 SQL Editor 에서 손으로 실행해 둔 DB 에는
`schema_migrations` 기록이 없다. 그대로 돌리면 1번부터 다시 실행하려다
"이미 존재함" 으로 멈춘다. 실행기가 그 상태를 먼저 알아보고 멈춘 뒤 안내한다.

```bash
npm run db:migrate -- --adopt   # 이미 적용된 것은 실행하지 않고 기록만, 나머지만 실행
```

각 마이그레이션 파일 첫 줄의 `-- applied-if:` 질의로 판별한다. 스키마를 고치지
않고 기록만 맞추므로 기존 데이터에 손대지 않는다.

실행 이력은 DB 의 `schema_migrations` 에 남는다. 파일 하나가 통째로 한 트랜잭션이라
중간에 실패하면 그 파일은 아무것도 적용되지 않고, 고친 뒤 다시 돌리면 남은
것부터 이어서 실행한다.

```
20260906000000_init.sql        스키마 · 카운터 트리거 · RLS
20260906010000_auth.sql        핸들 규칙 · 컬럼 GRANT
20260906020000_lock_anon.sql   anon 권한 축소 · RLS 재확인
20260907000000_contrib.sql     기고 권한 · 초대장 · updated_at 트리거 수정  ← M2-1
```

**B. 손으로 (스크립트를 못 쓰는 상황이라면)**

SQL Editor → New query → 위 파일을 **이름 순서대로** 하나씩 붙여넣고 Run.
순서를 지킬 것 — 뒤의 파일이 앞의 정책을 교체한다.

### 1.3 편집장 계정

**`is_admin` 은 애플리케이션 어디에서도 켤 수 없다.** 앱에서 편집장을 만들 수
있으면 그 경로가 곧 권한 상승 경로가 되기 때문이다. 그래서 첫 편집장은 반드시
앱 바깥에서 만들어야 하고, 이 계정이 없으면 아무도 `/editor` 에 들어갈 수 없어
**누구도 기고 권한을 받지 못한다.**

```bash
npm run db:admin -- 내주소@example.com
npm run db:admin -- 내주소@example.com --handle jiwon --name 배지원   # 핸들·이름 지정
```

계정이 없으면 만들고, profile 이 없으면 만들고, `is_admin` 과 `can_write` 를 켠다.
이미 다 돼 있으면 아무것도 바꾸지 않는다. `SUPABASE_SERVICE_ROLE_KEY` 만 있으면
되고 `DATABASE_URL` 은 필요 없다. 핸들을 안 주면 이메일 앞부분에서 만든다.

이 계정은 그대로 매직링크 로그인 계정이 된다. 그 주소로 `/login` 에서
로그인하면 마스트헤드에 "쓰기" 가 뜨고 `/editor` 가 열린다.

> 손으로 하고 싶으면 대시보드 Authentication → Users → Add user 로 계정을 만들고
> UID 를 `supabase/seed.sql` 에 넣어 SQL Editor 에서 실행해도 결과는 같다.

### 1.4 RLS 확인

마이그레이션이 네 테이블 전부에 RLS 를 켜고 정책을 만든다.

**대시보드의 정책 목록만 보고 판단하지 말 것.** 정책은 RLS 가 켜져 있을 때만
작동하는데, 목록은 RLS 가 꺼져 있어도 그대로 채워져 보인다. `RLS DISABLED` 배지가
붙은 채 정책이 세 줄 나열돼 있으면 그 테이블은 열려 있는 것이다.

`supabase/check_rls.sql` 을 SQL Editor 에 통째로 붙여넣고 Run. **결과 표의
"결과" 열이 전부 PASS 여야 한다.** 검사하는 것:

1. 다섯 테이블 모두 `rls_enabled = true`
2. `anon` 의 권한이 `SELECT` 뿐
3. `authenticated` 의 컬럼 권한에 `is_admin`, `can_write`, `like_count`,
   `comment_count` 가 없음
4. 그러면서 글쓰기·가입에 필요한 컬럼 권한은 살아 있음
5. `contributor_invites` 가 `anon` `authenticated` 양쪽에 완전히 닫혀 있음
   (이메일이 들어 있는 테이블이다)
6. 비로그인이 실제로 발행글만 읽음

하나라도 FAIL 이면 마이그레이션이 끝까지 돌지 않은 것이다. 다시 실행할 것 —
`20260906020000_lock_anon.sql` 과 `20260907000000_contrib.sql` 은 몇 번을 돌려도
결과가 같다.

그 다음 **정책 우회 테스트를 돌린다.** 기획안 §6 M2 / M2-1 의 완료 기준이다.

```bash
npm run test:rls    # .env.local 을 자동으로 읽는다
```

계정 세 개(초대받은 기고자 둘 + 초대받지 않은 계정 하나)를 만들어 남의 글
수정·삭제, 남의 초안 열람, 남의 이름으로 글쓰기, 비로그인 좋아요 삽입,
스스로 관리자 되기, **초대 없이 글쓰기**, **스스로 기고 권한 켜기**,
**초대 명단 읽기**, **권한 회수 후 자기 글 수정**을 차례로 시도하고 전부 막히는지
본다. 좋아요가 글의 `updated_at` 을 밀지 않는지도 여기서 확인한다.
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
이 실수를 잡지만(`scripts/check-env.mjs`), 이름을 처음부터 맞추는 편이 낫다.

---

## 2. 로컬에서 먼저 확인

```bash
cp .env.example .env.local   # 위에서 모은 값 네 개
npm install
npm run dev
```

1. <http://localhost:3000/login> → 1.3 에서 만든 편집장 주소로 매직링크 로그인
2. 마스트헤드에 **쓰기** 가 뜨는지 확인 → `/write` 에서 제목·부제·카테고리·본문을
   넣고 **발행**
3. 홈에 뜨는지, 필자명을 누르면 `/u/<핸들>` 로 가는지 확인
4. **썸네일 URL 을 비운 채로 한 건 더 발행** — 카드가 성립하는지 확인
   (기획안 §1 의 전제 조건)
5. <http://localhost:3000/me> 에서 두 글이 "발행한 글" 에 있는지 확인
6. <http://localhost:3000/feed.xml> 에 두 글이 들어왔는지 확인

**초대제를 확인하려면** 다른 주소로 `/signup` 해서 계정을 하나 더 만든다.
그 계정으로 `/write` 에 가면 "아직 초대장이 없습니다" 가 떠야 한다. 편집장 계정의
`/editor` 명단에서 그 사람에게 **기고 권한 주기** 를 누르면, 새로고침 후 `/write`
가 열린다.

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
| Production Branch | `main` |

`main` 이 저장소의 기본 브랜치다. 작업은 `claude/*` 브랜치에서 하고 `main` 으로
병합하면 Production 배포가 돈다. 작업 브랜치에 푸시하면 Preview 배포가 돈다.

### 3.2 환경변수

Settings → Environment Variables. **Type 을 반드시 구분해서 넣는다.**

| 변수 | Type | 빌드가 멈추는가 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Config** | **예** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Config** | **예** |
| `NEXT_PUBLIC_SITE_URL` | **Config** | 아니오 (경고) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | 아니오 |

M2-1 에서 `ADMIN_PASSWORD` 와 `ADMIN_AUTHOR_ID` 가 사라졌다. 기존 배포에 남아
있다면 지워도 된다 — 아무 코드도 읽지 않는다.

`NEXT_PUBLIC_SITE_URL` 은 배포 도메인이라 **첫 배포가 성공해야 값을 알 수 있다.**
그래서 없어도 빌드는 통과시키고 경고만 한다. 도메인이 정해진 뒤 3.3 에서 채운다.
다만 `NEXT_PUBLIC_` 이므로 채울 때는 반드시 Config 여야 한다.

> **여기서 가장 많이 막힌다.**
> Vercel 의 **Sensitive(Secret, 자물쇠 아이콘) 변수는 빌드 단계에 주입되지 않는다.**
> 서버리스 함수가 요청을 처리할 때만 들어온다.
>
> 그런데 `NEXT_PUBLIC_` 값은 Next 가 **빌드 시점에 클라이언트 번들에 그대로 박아
> 넣는다.** 그래서 이 셋을 Secret 으로 만들면 빌드가 값을 못 찾고 실패한다.
> 반드시 **Config** 여야 한다. anon 키는 원래 브라우저에 노출되는 값이고
> RLS 가 보호하므로 Config 로 두는 것이 옳다.
>
> 한 번 Secret 으로 만든 변수는 값을 다시 볼 수 없어 Type 을 바꿀 수 없다.
> **지우고 Config 로 다시 만들어야 한다.**

`SUPABASE_SERVICE_ROLE_KEY` 는 서버에서만 읽으므로 Secret 이 맞다. 빌드 로그에 "빌드에서 안 보입니다" 라고 뜨는 것은 정상이며, 빌드를 막지 않는다.

환경 선택은 **Production 과 Preview** 면 충분하다. Development 는 `vercel dev` 를
쓸 때만 필요하고, 로컬은 `.env.local` 을 쓴다.

앞의 두 개 중 하나라도 빠지면 **빌드가 멈추고 어느 변수인지 이름을 찍는다**
(`scripts/check-env.mjs`). 배포된 다음 첫 방문자의 요청에서 500 으로 죽는 것보다 낫다.

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

- 커스텀 도메인
- CI — 지금은 Vercel 빌드가 사실상 유일한 검사다. `npm run typecheck` 를
  PR 에서 돌리는 워크플로가 있으면 좋지만 아직 없다.
