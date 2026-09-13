-- 한 계정의 실제 상태를 있는 그대로 찍는다.
--
--   psql "$DATABASE_URL" -v email=me@example.com -f supabase/whoami.sql
--
-- 왜 필요한가. "화면에서는 권한이 없다는데 db:admin 은 편집장이라고 한다" 는
-- 상황이 실제로 나왔다. db:admin 은 "이미 편집장" 한 줄만 찍기 때문에
-- 계정이 둘로 갈렸는지, is_admin 이 정말 켜져 있는지, 브라우저가 보는 행이
-- 같은 행인지를 구분해 주지 못한다. 여기서는 두 테이블을 조인해서 보여준다.
--
-- 읽기만 한다. 아무것도 바꾸지 않는다.

\echo ''
\echo '--- 이 주소로 만들어진 계정 (auth.users) ---'
select id, email, created_at, last_sign_in_at, email_confirmed_at
from auth.users
where email = :'email';

\echo ''
\echo '--- 그 계정에 붙은 프로필 (profiles) ---'
-- 여기가 비어 있으면 로그인은 되는데 프로필이 없는 상태다.
-- 그때 /editor 는 404 가 아니라 /auth/complete 로 보낸다.
select p.id, p.handle, p.display_name, p.is_admin, p.can_write, p.created_at
from profiles p
join auth.users u on u.id = p.id
where u.email = :'email';

\echo ''
\echo '--- is_admin 이 켜진 프로필 전부 ---'
-- 편집장이 0명이면 아무도 /editor 에 못 들어가고, 따라서 아무도 기고 권한을
-- 받지 못한다. 이 목록이 비어 있는 것이 가장 흔한 "다 됐는데 안 되는" 원인이다.
select p.id, p.handle, p.display_name, p.can_write, u.email
from profiles p
left join auth.users u on u.id = p.id
where p.is_admin;

\echo ''
\echo '--- 규모 ---'
select
  (select count(*) from auth.users)                          as "계정",
  (select count(*) from profiles)                            as "프로필",
  (select count(*) from profiles where is_admin)             as "편집장",
  (select count(*) from profiles where can_write)            as "기고자",
  (select count(*) from posts)                               as "글",
  (select count(*) from posts where status = 'published')    as "발행됨",
  (select count(*) from posts where notion_page_id is not null) as "노션에서 온 글";
