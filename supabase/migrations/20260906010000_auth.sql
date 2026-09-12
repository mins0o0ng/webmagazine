-- applied-if: select exists (select 1 from pg_constraint where conname = 'profiles_handle_format')
-- M2 인증 — 핸들 규칙과 가입 경로 보강
--
-- 기획안 §6 M2 "가입 시 profiles 행 생성 (핸들 중복 검사 포함)".
-- 애플리케이션에도 같은 검사가 있지만, 형식은 DB 에서도 강제한다.
-- 서버 액션을 우회해 anon 키로 직접 profiles 에 insert 하는 경로가 남아 있기 때문이다
-- (RLS 는 "본인 행만"까지만 보장하지, 그 행의 내용이 말이 되는지는 보지 않는다).

-- 1. 핸들 형식 -------------------------------------------------------------
-- lib/auth.ts 의 HANDLE_PATTERN 과 같은 규칙.
alter table profiles
  add constraint profiles_handle_format
  check (handle ~ '^[a-z0-9_]{3,20}$');

-- 2. 핸들 대소문자 ---------------------------------------------------------
-- handle 에 이미 unique 제약이 있지만 대소문자를 구분한다. 형식 제약이
-- 소문자만 허용하므로 실질적으로는 충돌하지 않지만, 제약이 나중에 완화될 경우를
-- 대비해 조회 인덱스를 소문자 기준으로 하나 더 둔다.
create unique index if not exists profiles_handle_lower_idx on profiles (lower(handle));

-- 3. 표시 이름 -------------------------------------------------------------
alter table profiles
  add constraint profiles_display_name_length
  check (char_length(display_name) between 1 and 20);

-- 4. 가입 직후의 빈 상태 ----------------------------------------------------
-- 매직링크를 눌러 auth.users 행이 생긴 시점과 profiles 행이 생기는 시점 사이에는
-- 틈이 있다. 그 사이에 사용자가 이탈하면 profile 없는 계정이 남는다.
-- 애플리케이션은 그 상태를 감지해 /auth/complete 로 보낸다. DB 는 그냥 두면 된다 —
-- 트리거로 자동 생성하면 사용자가 고른 핸들을 반영할 수 없다.

-- 5. 이메일 노출 방지 -------------------------------------------------------
-- profiles 는 전체 공개(select using true)다. 이메일은 auth.users 에만 있고
-- profiles 에는 없으므로 그대로 두면 된다. 나중에 profiles 에 연락처를 추가할 일이
-- 생기면 공개 정책부터 다시 볼 것.

-- ---------------------------------------------------------------------------
-- 6. 컬럼 단위 권한 — 권한 상승 차단
-- ---------------------------------------------------------------------------
--
-- RLS 는 "어느 행을 건드릴 수 있는가"만 정한다. "그 행의 어느 칸을 건드릴 수
-- 있는가"는 정하지 않는다. 1차 마이그레이션의 정책만으로는 다음이 전부 가능하다.
--
--   1. 가입한 사람이 자기 profile 에 is_admin = true 를 써넣는다.
--      → is_admin() 이 true 가 되고, posts_update_own 이 관리자에게 남의 글
--        수정을 허용하므로 누구나 모든 글을 고치고 내릴 수 있게 된다.
--   2. 자기 글의 like_count 를 임의의 숫자로 바꾼다.
--   3. 자기 댓글의 post_id 를 바꿔 다른 글로 옮긴다.
--
-- 1번은 가입 기능이 열리는 순간(M2) 실제 권한 상승 경로가 된다.
-- 컬럼 단위 GRANT 로 막는다. service_role 은 별도 롤이라 영향받지 않는다.

revoke insert, update on profiles from anon, authenticated;
grant insert (id, handle, display_name, bio, avatar_url) on profiles to authenticated;
grant update (handle, display_name, bio, avatar_url) on profiles to authenticated;

revoke insert, update on posts from anon, authenticated;
grant insert (author_id, title, deck, body, category, status, thumbnail_url, thumbnail_ratio)
  on posts to authenticated;
grant update (title, deck, body, category, status, thumbnail_url, thumbnail_ratio)
  on posts to authenticated;

revoke insert, update on comments from anon, authenticated;
grant insert (post_id, author_id, body) on comments to authenticated;
grant update (body, deleted_at) on comments to authenticated;

revoke insert, update on likes from anon, authenticated;
grant insert (post_id, actor_key, user_id) on likes to authenticated;

-- like_count / comment_count 는 트리거만 건드린다. 트리거 함수는 security definer 라
-- 소유자 권한으로 돌기 때문에 위 revoke 의 영향을 받지 않는다.
-- updated_at / published_at 도 BEFORE 트리거가 NEW 를 고치는 방식이라 마찬가지다.

-- 관리자 지정은 대시보드나 service_role 로만 한다. 애플리케이션 경로는 없다.
