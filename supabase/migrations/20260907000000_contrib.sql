-- M2-1 타인 기고 — 초대제
--
-- 결정: 가입은 누구나, 기고는 초대받은 사람만.
--
-- 왜 이렇게 정했는가. M2 까지의 스키마는 posts 에 대해 "author_id = auth.uid()"
-- 만 검사한다. 그 상태로 /write 를 세션 인증으로 열면 가입한 누구나 즉시
-- status = 'published' 로 홈 1면에 글을 올릴 수 있다. 편집권이 없는 매거진은
-- 매거진이 아니라 게시판이고, 스팸글 한 건에 매체 전체의 신뢰가 걸린다.
--
-- 심사 큐(draft → review → published) 대신 초대제를 고른 이유는 편집 비용이다.
-- 심사는 글마다 사람이 붙어야 하지만, 초대는 사람마다 한 번만 붙으면 된다.
-- 발행량이 늘어 초대만으로 품질이 안 잡히면 그때 status 에 'review' 를 더한다.
--
-- 이 파일은 몇 번을 돌려도 결과가 같다.

-- ---------------------------------------------------------------------------
-- 1. 기고 권한 플래그
-- ---------------------------------------------------------------------------

alter table profiles
  add column if not exists can_write boolean not null default false;

-- 기존 관리자는 당연히 쓴다. 이 문장이 없으면 마이그레이션 직후 아무도 못 쓴다.
update profiles set can_write = true where is_admin and not can_write;

comment on column profiles.can_write is
  '기고 권한. 편집실(/editor)에서만 켜고 끈다. is_admin 과 마찬가지로 '
  '컬럼 GRANT 에서 빠져 있어 본인이 스스로 켤 수 없다.';

-- ---------------------------------------------------------------------------
-- 2. 초대장
-- ---------------------------------------------------------------------------
--
-- 아직 가입하지 않은 사람을 미리 초대해두기 위한 테이블이다.
-- 이미 가입한 사람은 이게 필요 없다 — 편집실의 명단에서 바로 켜면 된다.

create table if not exists contributor_invites (
  email       text primary key check (email = lower(email) and email like '%@%'),
  note        text,
  invited_by  uuid references profiles on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references profiles on delete set null
);

-- 이메일은 개인정보다. 앱 롤 어느 쪽에도 주지 않는다.
--
-- 주의: 마이그레이션 3 의 alter default privileges 가 새 테이블마다 anon 에게
-- select 를 준다. 그대로 두면 초대 명단이 anon 키로 통째로 읽힌다. 명시적으로 회수한다.
revoke all on contributor_invites from anon, authenticated;

alter table contributor_invites enable row level security;

-- 정책을 하나도 만들지 않는다. RLS 가 켜져 있고 정책이 없으면 전부 거부다.
-- service_role 은 RLS 를 우회하므로 서버 액션만 이 테이블에 닿는다.

-- ---------------------------------------------------------------------------
-- 3. 권한 판정 함수
-- ---------------------------------------------------------------------------
--
-- is_admin() 과 같은 이유로 security definer 다. 정책 안에서 profiles 를 다시
-- select 하면 profiles 정책이 재귀한다.
--
-- 함수 이름을 컬럼과 다르게(may_write) 둔 이유: 정책 본문에서 can_write 라고 쓰면
-- 그게 컬럼인지 함수인지 읽는 사람이 매번 확인해야 한다.

create or replace function may_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select can_write or is_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. posts 정책 — 초대받지 않은 사람은 글을 만들 수 없다
-- ---------------------------------------------------------------------------

drop policy if exists posts_insert_own on posts;
create policy posts_insert_own on posts
  for insert with check (author_id = auth.uid() and may_write());

-- 권한이 회수되면 새 글뿐 아니라 기존 글 수정도 멈춘다. 회수의 의미가
-- "더 이상 이 지면에 쓰지 않는다" 이므로 발행된 글을 고치는 것도 포함한다.
-- 관리자는 그대로 남의 글을 손댈 수 있다(오탈자·법적 요청·숨김 처리).
drop policy if exists posts_update_own on posts;
create policy posts_update_own on posts
  for update using ((author_id = auth.uid() and may_write()) or is_admin())
  with check ((author_id = auth.uid() and may_write()) or is_admin());

-- 삭제 정책(posts_delete_own)은 건드리지 않는다. 권한이 회수된 뒤에도 자기 글을
-- 내릴 수는 있어야 한다 — 남의 지면에 자기 글을 붙잡아 두는 쪽이 더 나쁘다.

-- ---------------------------------------------------------------------------
-- 5. 컬럼 단위 권한 — 자가 승격 차단
-- ---------------------------------------------------------------------------
--
-- 새로 만든 컬럼에는 기존 컬럼 GRANT 가 따라붙지 않으므로 can_write 는 기본적으로
-- 이미 막혀 있다. 그래도 명시적으로 다시 적는다. 마이그레이션 3 과 같은 이유다 —
-- 권한 모델이 틀어졌을 때 되돌릴 수 있는 파일이 하나는 있어야 한다.
--
-- can_write 를 스스로 켤 수 있으면 초대제 전체가 없는 것과 같다.

revoke insert, update on profiles from anon, authenticated;
grant insert (id, handle, display_name, bio, avatar_url) on profiles to authenticated;
grant update (handle, display_name, bio, avatar_url)     on profiles to authenticated;

-- is_admin 과 can_write 는 어느 목록에도 없다. 대시보드나 service_role 로만 바뀐다.

-- ---------------------------------------------------------------------------
-- 6. 좋아요가 글의 updated_at 을 밀던 문제
-- ---------------------------------------------------------------------------
--
-- sync_like_count() 는 posts 를 UPDATE 하고, 그 UPDATE 가 posts_touch_updated_at
-- 을 깨운다. 그래서 아무도 글을 고치지 않았는데 좋아요 한 번에 updated_at 이 now()
-- 로 밀린다. 지금은 updated_at 을 읽는 화면이 없어 조용하지만, M2-1 의 /me 가
-- "마지막 수정" 을 보여주고 M3 에서 좋아요가 붙는 순간 눈에 보이는 오작동이 된다.
--
-- 카운터를 제외 목록으로 적는 대신 "사람이 고치는 칸" 을 허용 목록으로 적는다.
-- 나중에 카운터가 하나 더 늘어도 이 조건은 그대로 옳다.

drop trigger if exists posts_touch_updated_at on posts;
create trigger posts_touch_updated_at
  before update on posts
  for each row
  when (
    old.title           is distinct from new.title
    or old.deck            is distinct from new.deck
    or old.body            is distinct from new.body
    or old.category        is distinct from new.category
    or old.status          is distinct from new.status
    or old.thumbnail_url   is distinct from new.thumbnail_url
    or old.thumbnail_ratio is distinct from new.thumbnail_ratio
  )
  execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 7. 필자 페이지용 인덱스
-- ---------------------------------------------------------------------------
--
-- /u/[handle] 은 "이 사람의 발행글을 최신순으로" 를 묻는다. posts_author_idx 는
-- (author_id, created_at desc) 라 status 필터와 published_at 정렬을 태우지 못한다.

create index if not exists posts_author_published_idx
  on posts (author_id, published_at desc)
  where status = 'published';

-- 확인은 supabase/check_rls.sql 로 한다.
