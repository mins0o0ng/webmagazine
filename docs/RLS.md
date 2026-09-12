# RLS — 이 프로젝트의 보안 모델

Row Level Security 는 **"어느 행을 볼 수 있고 건드릴 수 있는가" 를 애플리케이션이
아니라 데이터베이스가 정하는 장치**다. Postgres 기본 기능이고, 이 프로젝트에서는
장식이 아니라 유일하게 믿을 수 있는 방어선이다.

이 문서는 그 이유와, 지금 걸려 있는 정책과, RLS 가 **못** 막는 것들을 적는다.

---

## 1. 왜 필수인가

`NEXT_PUBLIC_SUPABASE_ANON_KEY` 는 이름 그대로 **브라우저 번들에 박힌다.**
누구나 개발자 도구에서 꺼내 이렇게 할 수 있다.

```js
createClient('https://xxx.supabase.co', '꺼낸-anon-키')
  .from('posts').delete().neq('id', 0)
```

서버 액션을 아무리 잘 짜도 소용없다. **공격자는 우리 코드를 거치지 않고 Supabase 에
직접 말을 건다.** 그래서 방어선이 DB 안에 있어야 하고, 그게 RLS 다.

`lib/supabase.ts` 에 클라이언트가 셋인 이유가 이것이다.

| 함수 | 키 | `auth.uid()` | RLS |
|---|---|---|---|
| `publicClient()` | anon | `null` | **적용** — 비로그인이 보는 것만. ISR 페이지가 쓴다 |
| `sessionClient()` | anon + 사용자 JWT | 그 사람 UUID | **적용** — 그 사람 기준 |
| `adminClient()` | service_role | `null` | **우회** — 서버에서, 게이트 뒤에서만 |

`adminClient()` 를 부르는 순간 DB 는 더 이상 막아주지 않는다. 그래서 M2-1 에서
`savePost` 를 `adminClient` → `sessionClient` 로 옮겼다. service_role 이 닿는 코드가
적을수록 좋다.

---

## 2. 정책 읽는 법 — `USING` vs `WITH CHECK`

이 둘의 구분이 RLS 의 8할이다.

- **`USING`** — "어느 행을 **볼/집을** 수 있나". SELECT · UPDATE · DELETE 의 대상 필터.
- **`WITH CHECK`** — "어떤 행을 **남길** 수 있나". INSERT · UPDATE 의 결과 검사.

`posts_update_own` 에 둘 다 있는 이유:

```sql
create policy posts_update_own on posts
  for update using ((author_id = auth.uid() and may_write()) or is_admin())
  with check ((author_id = auth.uid() and may_write()) or is_admin());
```

`USING` 만 있으면 **"내 글을 집어서 `author_id` 를 남의 것으로 바꾸는"** 시도가
통과한다 — 집을 때는 분명히 내 글이었기 때문이다. `WITH CHECK` 가 바뀐 뒤의 행도
검사해서 그걸 막는다.

---

## 3. 지금 걸려 있는 정책

```
profiles   read   using (true)                        전체 공개. 필자 페이지가 이걸 쓴다
           insert with check (id = auth.uid())        남의 프로필은 못 만든다
           update using/check (id = auth.uid())

posts      read   using (status = 'published'
                         or author_id = auth.uid()
                         or is_admin())               초안은 본인·편집장만
           insert with check (author_id = auth.uid()
                              and may_write())        ← M2-1 초대제
           update using/check (위 조건 or is_admin())
           delete using (author_id = auth.uid())      회수당해도 자기 글은 내릴 수 있다

likes      read   using (true)                        ⚠ 5번 항목 참고
           insert with check (auth.uid() is not null
                              and user_id = auth.uid()
                              and actor_key = auth.uid()::text)
           delete using (actor_key = auth.uid()::text)

comments   read   using (deleted_at is null
                         or author_id = auth.uid() or is_admin())
           insert with check (auth.uid() is not null and author_id = auth.uid())
           update using/check (author_id = auth.uid() or is_admin())

contributor_invites    RLS 켜짐 + 정책 0개 = 전면 거부
```

마지막 줄이 관용구다. **RLS 가 켜져 있고 정책이 하나도 없으면 기본값은 "전부 거부"** 라서,
이메일이 든 초대 명단은 anon 도 로그인 사용자도 한 행도 못 읽는다. `service_role` 만
우회해서 서버 액션이 다룬다.

### 헬퍼 두 개

```sql
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select is_admin from profiles where id = auth.uid()), false);
  $$;

create or replace function may_write() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select can_write or is_admin from profiles where id = auth.uid()), false);
  $$;
```

**`security definer` 인 이유는 재귀 때문이다.** `profiles` 정책 안에서
`select ... from profiles` 를 하면 그 select 에 다시 정책이 걸려 무한 재귀한다.
`security definer` 는 함수 소유자 권한으로 돌아 정책을 거치지 않는다.

함수 이름을 컬럼(`can_write`)과 다르게(`may_write`) 둔 것도 의도다. 정책 본문에서
`can_write` 라고 쓰면 읽는 사람이 매번 "이게 컬럼인가 함수인가" 를 확인해야 한다.

---

## 4. RLS 가 **못** 막는 것

### 4.1 컬럼은 안 본다

**RLS 는 어느 _행_ 을 건드릴지만 정하지, 그 행의 어느 _칸_ 을 건드릴지는 정하지 않는다.**

`profiles_update_self` 는 "본인 행 수정 허용" 이다. 그래서 M2 이전에는 이게 통과했다.

```js
supabase.from('profiles').update({ is_admin: true }).eq('id', 내_id)
// 본인 행이므로 RLS 통과 → 스스로 관리자
```

관리자가 되면 `posts_update_own` 의 `or is_admin()` 이 켜져 **모든 글을 고치고 내릴 수
있게 된다.** 가입이 열리는 순간(M2) 실제 권한 상승 경로였다. 컬럼 단위 `GRANT` 로 막았다.

```sql
revoke insert, update on profiles from anon, authenticated;
grant insert (id, handle, display_name, bio, avatar_url) on profiles to authenticated;
grant update (handle, display_name, bio, avatar_url)     on profiles to authenticated;
--          ↑ is_admin 과 can_write 는 어느 목록에도 없다
```

M2-1 의 `can_write` 도 같은 이유로 목록 밖이다. 스스로 켤 수 있으면 초대제 전체가
장식이 된다. **RLS 와 컬럼 GRANT 는 별개의 두 겹이고, 둘 다 있어야 한다.**

같은 방식으로 `posts.like_count` · `comment_count` 직접 조작과 댓글의 `post_id` 변경도
막았다. 카운터는 트리거만 건드리는데, 트리거 함수는 `security definer` 라 이 revoke 의
영향을 받지 않는다.

### 4.2 `service_role` 은 그냥 통과한다

`adminClient()` 를 쓰는 순간 RLS 는 없는 것과 같다. 그래서 `lib/contributors.ts` 와
`app/editor/actions.ts` 의 모든 액션이 `gate()` 로 시작한다. **하나라도 빠지면 로그인한
아무나 자기에게 기고 권한을 줄 수 있다.**

`profiles.can_write` 와 `is_admin` 이 컬럼 GRANT 에서 빠져 있어 `authenticated` 롤로는
아예 쓸 수 없기 때문에, 권한 부여만큼은 service_role 경로가 불가피하다. 그 대가로
그 파일들은 서버에서, 게이트 뒤에서만 돈다.

### 4.3 정책이 있어도 RLS 가 꺼져 있으면 무의미

`20260906020000_lock_anon.sql` 이 남긴 실제 사고 기록이다.

> 대시보드에서 comments 의 RLS 가 꺼진 채로 정책만 남아 있는 상태를 확인했다.
> 정책은 RLS 가 켜져 있을 때만 작동한다.

**Supabase 대시보드는 RLS 가 꺼져 있어도 정책 목록을 그대로 보여준다.** 정책이 세 줄
나열돼 있으면 안전해 보이지만 실제로는 테이블이 활짝 열려 있다. 그래서
`supabase/check_rls.sql` 의 첫 검사는 "정책이 있나" 가 아니라
**"`pg_class.relrowsecurity` 가 true 인가"** 다.

---

## 5. 지금 남아 있는 구멍

```sql
create policy likes_read_all on likes for select using (true);
```

`likes` 전체가 anon 에게 열려 있어 **어느 로그인 사용자가 어떤 글에 좋아요를 눌렀는지
전부 조회된다.** 지금은 좋아요 UI 가 없어 드러나지 않을 뿐이다. 에세이·연애 카테고리가
있는 매거진에서 이건 프라이버시 사고다.

개수는 이미 `posts.like_count` 에 비정규화돼 있으므로, `select` 를 본인 행으로 좁히면
된다. M3(좋아요) 을 열 때 함께 고칠 것.

같은 자리에서 결정해야 할 것이 하나 더 있다: **비로그인 좋아요의 `actor_key`**.
쿠키 UUID 는 시크릿 창으로 무한 좋아요가 되고, IP 해시는 개인정보 문제와 NAT 뒤
사용자 문제를 동시에 만든다. 초대제를 고른 이 지면이라면 "좋아요도 로그인 사용자만"
이 일관되며, 그러면 `likes` 의 RLS 정책이 이미 완성돼 있어 서버 액션 자체가 필요 없어진다.

---

## 6. 함정 모음

**RLS 가 막은 쓰기는 오류가 아니라 "0행" 으로 온다.**

```js
const { data, error } = await client.from('posts').update({...}).eq('id', 남의글).select('id');
// error 는 null 이다. data 가 [] 일 뿐이다.
```

`error` 만 보고 판단하면 **모든 검사가 통과한 것처럼 보인다.** `scripts/rls-test.mjs` 가
전부 `.select()` 를 붙여 반환된 행 개수로 판정하는 이유이고, `savePost` 가
"이 글을 수정할 권한이 없습니다" 를 띄우는 방식도 같다.

**새 테이블은 기본으로 열린다.** Supabase 는 `anon` 에게 전권을 주는 것이 기본이다.
`20260906020000_lock_anon.sql` 이 기본값 자체를 바꿔 두었다.

```sql
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public grant select on tables to anon;
```

그래도 `contributor_invites` 는 `revoke all` 을 **또** 적었다. 기본값이
`grant select` 라서, 이메일이 든 테이블은 그 기본값조차 받으면 안 되기 때문이다.

**테이블 소유자도 RLS 를 우회한다.** Supabase 에서 `public` 스키마의 테이블은
`postgres` 소유이고, `service_role` 은 `BYPASSRLS` 다. 둘 다 정책을 거치지 않는다.
정말로 소유자에게까지 강제하려면 `alter table ... force row level security` 가 필요한데,
지금은 필요하지 않다 — 소유자 연결은 사람이 대시보드를 쓸 때뿐이다.

---

## 7. 확인하는 두 가지 방법

```bash
# 1. 설정이 맞는가 — Supabase SQL Editor 에 통째로 붙여넣는다
supabase/check_rls.sql      # 19개 항목 PASS/FAIL 표

# 2. 실제로 막히는가 — 계정 셋을 만들어 우회를 시도한다
npm run test:rls
```

**둘은 다른 질문이고 둘 다 필요하다.** 1번은 "권한 설정이 이렇게 돼 있다" 를 보고,
2번은 "진짜로 공격해 봤더니 막혔다" 를 본다.

`check_rls.sql` 이 검사하는 것:

1. 다섯 테이블 모두 `rls_enabled = true`
2. `anon` 의 권한이 `SELECT` 뿐
3. `authenticated` 의 컬럼 권한에 `is_admin` · `can_write` · `like_count` · `comment_count` 가 없음
4. 그러면서 글쓰기·가입에 필요한 컬럼 권한은 살아 있음
5. `contributor_invites` 가 `anon` `authenticated` 양쪽에 완전히 닫혀 있음
6. 비로그인이 실제로 발행글만 읽음

`test:rls` 가 시도하는 것: 남의 글 수정·삭제, 남의 초안 열람, 남의 이름으로 글쓰기,
비로그인 좋아요 삽입, 스스로 관리자 되기, 초대 없이 글쓰기, 스스로 기고 권한 켜기,
초대 명단 읽기, 권한 회수 후 자기 글 수정. 여기에 좋아요가 글의 `updated_at` 을
밀지 않는지도 함께 본다.

---

## 8. 정책을 바꿀 때 지킬 것

1. **`USING` 을 손대면 `WITH CHECK` 도 같이 본다.** 하나만 고치면 위 2번의 구멍이 생긴다.
2. **컬럼을 추가하면 GRANT 를 확인한다.** 새 컬럼에는 기존 컬럼 GRANT 가 따라붙지
   않으므로 기본적으로 막혀 있지만, 권한과 관련된 컬럼이면 명시적으로 다시 적는다
   (`can_write` 를 마이그레이션 4 에서 다시 적은 이유).
3. **테이블을 추가하면 `revoke` 를 먼저 쓴다.** 기본값이 `grant select to anon` 이다.
4. **정책 안에서 같은 테이블을 읽지 않는다.** 필요하면 `security definer` 함수로 끊는다.
5. **바꾼 뒤에는 `check_rls.sql` 과 `npm run test:rls` 를 둘 다 돌린다.**
