# 웹매거진

기획안 v1.0 의 **마일스톤 1** 골격. Next.js (App Router) + Supabase.

현재 상태: M1 중 **디자인에 의존하지 않는 부분**이 구현되어 있다.
색상과 홈 레이아웃은 확정 디자인이 오면 교체한다 — 아래 [미해결](#미해결) 참고.

---

## 설치

```bash
npm install
cp .env.example .env.local   # 값을 채운다
npm run dev
```

### Supabase 준비

1. Supabase 프로젝트를 만들고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` 를 `.env.local` 에 넣는다.
2. SQL Editor 에서 `supabase/migrations/0001_init.sql` 을 실행한다.
3. **Authentication → Users → Add user** 로 관리자 계정을 하나 만든다.
4. 생성된 UUID 를 `supabase/seed.sql` 에 넣고 실행한 뒤, 같은 UUID 를
   `.env.local` 의 `ADMIN_AUTHOR_ID` 에 넣는다.

3~4번이 필요한 이유: `posts.author_id` 는 not null 이고 `profiles → auth.users` 를
참조한다. M1 은 인증이 없지만 auth 유저가 0명이면 글을 한 건도 삽입할 수 없다.
기획안 M1 체크리스트에 빠져 있던 단계다. 여기서 만든 계정은 M2 에서 매직링크가
붙으면 그대로 정상 로그인 계정이 되므로 버리는 작업이 아니다.

### `/write` 접근

M1 은 `ADMIN_PASSWORD` 환경변수 하나로 막는다(기획안 §6 M1).
입력하면 httpOnly 쿠키가 2주간 유지된다. M2 에서 Supabase Auth 세션으로 교체되며,
그때 `lib/adminGate.ts` 는 삭제된다.

---

## 구조

```
app/
  tokens.css          ★ 디자인 토큰 — 팔레트 교체 지점
  globals.css         리셋 + 레이아웃 유틸
  page.tsx            홈 (ISR 60초)
  p/[id]/             글 상세
  category/[slug]/    카테고리 목록 (ISR 60초)
  write/              새 글 · 수정 · 서버 액션
  feed.xml/           RSS
components/
  PostCard.tsx        썸네일 없이도 성립하는 카드 ← M1 전제 조건
  PostEditor.tsx      마크다운 textarea + 미리보기
  Markdown.tsx        본문 렌더러 (원시 HTML 비활성)
lib/
  supabase.ts         publicClient(anon, RLS 적용) / adminClient(service role)
  posts.ts            공개 읽기
  adminPosts.ts       초안 포함 읽기 — 게이트 통과 후에만
  adminGate.ts        M1 임시 인증
supabase/
  migrations/0001_init.sql
  seed.sql
```

### 렌더링 (§2.3)

| 화면 | 방식 |
|---|---|
| 홈, 카테고리 | ISR 60초 |
| 글 상세 | 온디맨드 (발행 시 `revalidatePath`) |
| 글쓰기 | 동적 |

---

## 기획안에서 바꾼 것

**1. `likes` 에 anon insert 정책을 만들지 않았다.**
기획안 §3.2 는 비로그인 좋아요를 위해 쿠키 UUID 를 `actor_key` 에 넣자고 하지만,
§5.3 이 말한 대로 anon 키는 클라이언트에 노출된다. 그 상태로 insert 를 열면
누구나 `actor_key` 를 난수로 바꿔가며 좋아요를 무한 삽입할 수 있다.
마이그레이션의 RLS 정책은 **로그인 사용자만** 다루고, 비로그인 경로는 M3 에서
서버 액션(service role) 전용으로 붙인다.

**2. 카테고리 표시 이름을 `lib/categories.ts` 로 뺐다.**
스키마는 기획안대로 Postgres enum 이지만, enum 은 변경에 마이그레이션이 필요하고
카테고리는 매거진에서 가장 자주 바뀌는 축이다(§8 도 인정). 라벨과 순서를 코드에
두면 이름 변경은 마이그레이션 없이 끝나고, 나중에 lookup 테이블로 옮길 때의
이음매가 된다.

**3. `published_at` 을 DB 트리거로 박는다.**
애플리케이션이 잊어도 `posts_feed_idx` 가 비지 않도록 보장한다.

**4. 댓글 카운터 트리거가 UPDATE 도 처리한다.**
댓글은 소프트 삭제라(§3.2) INSERT/DELETE 만으로는 `deleted_at` 이 채워질 때
카운터가 내려가지 않는다.

---

## 미해결

### 디자인 (차단됨)

- [ ] **팔레트** — `app/tokens.css` 의 `--color-*` 는 전부 placeholder.
      `Magazine Color Options.dc.html` 가 오면 이 블록만 교체하면 된다.
      컴포넌트는 리터럴 색을 쓰지 않는다.
- [ ] **홈 와이어프레임 v2** — 현재 홈은 잠정안(리드 + 그리드). `app/page.module.css`.
- [ ] **Pretendard 서빙** — CDN vs 자체 호스팅 미결정(§8). 지금은 시스템 폰트 폴백.
- [ ] 다크 모드 — 팔레트 확정 전에는 열지 않았다. 지금 지어내면 두 벌을 다 고쳐야 한다.

### 기획안 §8 의 미결정 사항

- [ ] 카테고리 5종 확정 (enum 이라 변경 시 마이그레이션)
- [ ] 이미지 업로드를 M1 에 넣을지 M4 까지 미룰지
      — 현재는 썸네일 URL 직접 입력. `next/image` 도 이 결정 후에 붙인다.
- [ ] 글 상세 와이어프레임 (댓글 UI 포함)

### 운영

- [ ] **발행 대기 원고 5편.** 기획안 §7 이 "글 발행 중단"을 리스크 표 맨 아래
      운영 리스크로 두었지만, 웹매거진이 죽는 가장 흔한 이유다. M1 완료 기준에
      넣기를 권한다 — 코드 어느 줄보다 생존률을 올린다.
- [ ] Supabase 무료 티어 비활성 프로젝트 일시정지 정책 확인 (§2.2)

### 이후 마일스톤

M2 (인증) · M2-1 (타인 기고) · M3 (좋아요) · M3-1 (댓글) · M4 (AI 썸네일)
— 기획안 §6 참고. 스키마와 RLS 는 이미 이들을 전제로 깔려 있다.

---

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드 (Supabase 연결 필요)
npm run typecheck  # tsc --noEmit
```
