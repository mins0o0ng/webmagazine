-- RLS 점검. Supabase SQL Editor 에 통째로 붙여넣고 실행한다.
--
-- 대시보드의 정책 목록만 보고 판단하면 안 된다. 정책은 RLS 가 켜져 있을 때만
-- 작동하는데, 목록은 RLS 가 꺼져 있어도 그대로 채워져 보인다.
--
-- 결과의 "결과" 열이 전부 PASS 여야 한다. 하나라도 FAIL 이면 마이그레이션이 끝까지
-- 돌지 않은 것이다. supabase/migrations/20260906020000_lock_anon.sql 을 실행하면
-- 권한과 RLS 가 다시 맞춰진다(몇 번을 돌려도 결과가 같다).
--
-- SQL Editor 는 스크립트의 마지막 문장 결과만 보여준다. 그래서 아래는 결과 표를
-- 반드시 맨 끝에 두었다. 중간에 select 를 더 끼워 넣으면 그게 대신 보인다.

-- 준비: 비로그인으로 전환해 실제로 무엇이 보이는지 읽어오는 임시 함수.
-- 읽기만 하고, 끝나면 역할을 되돌린다. 데이터는 바뀌지 않는다.
create or replace function pg_temp.anon_peek()
returns table(st text, n bigint)
language plpgsql
as $$
begin
  set local role anon;
  return query select p.status::text, count(*) from posts p group by p.status;
  reset role;
  return;
end $$;


-- ── 결과 표 (이 문장이 마지막이어야 한다) ────────────────────────────────────
select 검사, 결과, 실제값 from (

  -- 1. 네 테이블에 RLS 가 켜져 있는가
  -- FAIL 이면 정책이 몇 개 있든 그 테이블은 열려 있다.
  select
    1 as 순서, 'RLS 켜짐: ' || c.relname as 검사,
    case when c.relrowsecurity then 'PASS' else 'FAIL' end as 결과,
    c.relrowsecurity::text as 실제값
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relname in ('profiles', 'posts', 'likes', 'comments')

  union all

  -- 2. 비로그인(anon)에게 쓰기 권한이 없는가
  -- Supabase 기본 권한은 anon 에게 전권을 준다. 마이그레이션이 회수해야 한다.
  select
    2, 'anon 쓰기 불가: ' || t,
    case when has_table_privilege('anon', 'public.' || t, 'INSERT')
           or has_table_privilege('anon', 'public.' || t, 'UPDATE')
           or has_table_privilege('anon', 'public.' || t, 'DELETE')
         then 'FAIL' else 'PASS' end,
    concat_ws(',',
      case when has_table_privilege('anon','public.'||t,'INSERT') then 'INSERT' end,
      case when has_table_privilege('anon','public.'||t,'UPDATE') then 'UPDATE' end,
      case when has_table_privilege('anon','public.'||t,'DELETE') then 'DELETE' end,
      case when has_table_privilege('anon','public.'||t,'SELECT') then 'SELECT' end)
  from unnest(array['profiles','posts','likes','comments']) t

  union all

  -- 3. 로그인 사용자가 권한을 스스로 올릴 수 없는가
  -- is_admin 을 켤 수 있으면 남의 글을 전부 수정·삭제할 수 있게 된다.
  select
    3, '로그인 사용자가 ' || x.label || ' 를 못 바꾼다',
    case when has_column_privilege('authenticated', x.tbl, x.col, 'UPDATE')
         then 'FAIL' else 'PASS' end,
    has_column_privilege('authenticated', x.tbl, x.col, 'UPDATE')::text
  from (values
    ('public.profiles','is_admin','profiles.is_admin'),
    ('public.posts','like_count','posts.like_count'),
    ('public.posts','comment_count','posts.comment_count')
  ) as x(tbl, col, label)

  union all

  -- 4. 그러면서 앱이 여전히 동작하는가
  -- 너무 조이면 글쓰기가 막힌다. 여기는 PASS 가 "권한이 있다" 는 뜻이다.
  select
    4, '로그인 사용자가 ' || x.label || ' 를 쓸 수 있다',
    case when has_column_privilege('authenticated', x.tbl, x.col, x.priv)
         then 'PASS' else 'FAIL' end,
    has_column_privilege('authenticated', x.tbl, x.col, x.priv)::text
  from (values
    ('public.posts','title','UPDATE','글 제목'),
    ('public.posts','title','INSERT','새 글'),
    ('public.profiles','handle','INSERT','가입 시 핸들')
  ) as x(tbl, col, priv, label)

  union all

  -- 5. 설정이 아니라 실제로 막히는가
  -- 비로그인이 되어 직접 읽어본다. published 외의 상태가 보이면 RLS 가 안 걸린 것이다.
  select
    5, '비로그인에게 발행글만 보인다',
    case when exists (select 1 from pg_temp.anon_peek() where st <> 'published')
         then 'FAIL' else 'PASS' end,
    coalesce(
      (select string_agg(st || ' ' || n, ', ' order by st) from pg_temp.anon_peek()),
      '(발행된 글이 없음)')

) q
order by 순서, 검사;
