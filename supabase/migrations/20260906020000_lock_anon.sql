-- anon 권한 축소 + RLS 재확인
--
-- 배경 1. 마이그레이션 2 는 anon 에게서 insert, update 만 회수했다.
--   Supabase 기본 권한은 anon 에게 delete 도 준다. RLS 가 켜져 있으면 정책이 막지만,
--   RLS 가 꺼지는 순간 anon 키만으로 글·댓글·좋아요를 전부 지울 수 있는 상태가 된다.
--   anon 은 이 사이트에서 읽기 외에 할 일이 없다. 읽기만 남긴다.
--
-- 배경 2. 대시보드에서 comments 의 RLS 가 꺼진 채로 정책만 남아 있는 상태를 확인했다.
--   정책은 RLS 가 켜져 있을 때만 작동한다. 꺼져 있으면 정책 목록이 채워져 있어도
--   테이블은 그냥 열려 있다. 네 테이블 모두 다시 켠다(이미 켜져 있으면 아무 일도 없다).

-- 1. anon 은 읽기만 -----------------------------------------------------------
revoke all on profiles from anon;
revoke all on posts    from anon;
revoke all on likes    from anon;
revoke all on comments from anon;

grant select on profiles to anon;
grant select on posts    to anon;
grant select on likes    to anon;
grant select on comments to anon;

-- 어느 행이 보이는지는 계속 RLS 정책이 정한다. 발행글만 보이고 초안은 안 보인다.

-- 2. 로그인 사용자의 컬럼 권한 재확인 -------------------------------------------
-- 마이그레이션 2 에도 같은 내용이 있지만 그 파일은 제약 조건을 추가하므로 재실행되지
-- 않는다. 권한 모델이 틀어졌을 때 다시 돌릴 수 있는 파일이 하나는 있어야 해서
-- 여기에 다시 적는다. 이 파일은 몇 번을 돌려도 결과가 같다.
--
-- 특히 is_admin 이 빠져 있어야 한다. 켤 수 있으면 가입한 사람이 스스로 관리자가
-- 되고, posts_update_own 이 관리자에게 남의 글 수정을 허용하므로 전체가 열린다.

revoke insert, update on profiles from authenticated;
grant insert (id, handle, display_name, bio, avatar_url) on profiles to authenticated;
grant update (handle, display_name, bio, avatar_url)     on profiles to authenticated;

revoke insert, update on posts from authenticated;
grant insert (author_id, title, deck, body, category, status, thumbnail_url, thumbnail_ratio)
  on posts to authenticated;
grant update (title, deck, body, category, status, thumbnail_url, thumbnail_ratio)
  on posts to authenticated;

revoke insert, update on comments from authenticated;
grant insert (post_id, author_id, body) on comments to authenticated;
grant update (body, deleted_at)         on comments to authenticated;

revoke insert, update on likes from authenticated;
grant insert (post_id, actor_key, user_id) on likes to authenticated;

-- 3. RLS 재확인 ---------------------------------------------------------------
alter table profiles enable row level security;
alter table posts    enable row level security;
alter table likes    enable row level security;
alter table comments enable row level security;

-- 4. 앞으로 만들 테이블 --------------------------------------------------------
-- 새 테이블은 기본 권한으로 anon 에게 전권이 나간다. 기본값 자체를 바꿔둔다.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public grant select on tables to anon;

-- 확인은 supabase/check_rls.sql 로 한다.
