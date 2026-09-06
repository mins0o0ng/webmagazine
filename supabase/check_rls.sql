-- RLS 상태 점검. SQL Editor 에 붙여넣고 실행한다.
--
-- 대시보드의 정책 목록만 보고 판단하면 안 된다. 정책은 RLS 가 켜져 있을 때만
-- 작동하는데, 목록은 RLS 가 꺼져 있어도 그대로 채워져 보인다.

-- 1. 네 테이블 모두 rls_enabled = true 여야 한다 -----------------------------
select
  c.relname                                   as "테이블",
  c.relrowsecurity                            as "rls_enabled",
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as "정책 수"
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
order by c.relname;

-- 2. anon 은 SELECT 만 가지고 있어야 한다 ------------------------------------
-- INSERT / UPDATE / DELETE 가 한 줄이라도 나오면 마이그레이션 3 이 안 돌았다는 뜻이다.
select
  table_name  as "테이블",
  grantee     as "역할",
  string_agg(privilege_type, ', ' order by privilege_type) as "권한"
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 3. 실제로 막히는지 (동작 확인) ----------------------------------------------
-- 위 1~2 는 설정을 보는 것이고, 이건 anon 이 되어서 직접 읽어보는 것이다.
-- published 만 나와야 한다. draft 나 hidden 이 한 줄이라도 나오면 RLS 가 안 걸린 것이다.
-- 읽기만 하고 되돌리므로 데이터는 바뀌지 않는다.
begin;
  set local role anon;
  select status as "anon 에게 보이는 상태", count(*) as "글 수"
  from posts group by status order by status;
rollback;

-- 4. authenticated 가 건드릴 수 있는 컬럼 --------------------------------------
-- profiles 에 is_admin 이, posts 에 like_count / comment_count 가 나오면 안 된다.
-- 나오면 가입한 사람이 스스로 관리자가 되거나 좋아요 수를 조작할 수 있다.
select
  table_name  as "테이블",
  privilege_type as "권한",
  string_agg(column_name, ', ' order by column_name) as "컬럼"
from information_schema.column_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE')
group by table_name, privilege_type
order by table_name, privilege_type;
