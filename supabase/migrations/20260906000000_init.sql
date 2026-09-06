-- 웹매거진 초기 스키마
-- 기획안 v1.0 §3.1 의 스키마에 카운터 트리거(§3.2)와 RLS(§5.3)를 더한 것.

-- ---------------------------------------------------------------------------
-- 1. 열거형
-- ---------------------------------------------------------------------------

create type post_status as enum ('draft', 'published', 'hidden');
create type post_category as enum ('essay', 'place', 'love', 'life', 'pick');
create type thumb_ratio as enum ('3:2', '3:4', '1:1');

-- ---------------------------------------------------------------------------
-- 2. 테이블
-- ---------------------------------------------------------------------------

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  handle       text unique not null,
  display_name text not null,
  bio          text,
  avatar_url   text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table posts (
  id              bigint generated always as identity primary key,
  author_id       uuid not null references profiles on delete cascade,
  title           text not null,
  deck            text not null,
  body            text not null,
  category        post_category not null,
  status          post_status not null default 'draft',
  thumbnail_url   text,
  thumbnail_ratio thumb_ratio,
  like_count      integer not null default 0,
  comment_count   integer not null default 0,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index posts_feed_idx
  on posts (published_at desc)
  where status = 'published';

create index posts_author_idx on posts (author_id, created_at desc);

create table likes (
  post_id    bigint not null references posts on delete cascade,
  actor_key  text   not null,
  user_id    uuid   references profiles on delete set null,
  created_at timestamptz not null default now(),
  primary key (post_id, actor_key)
);

create table comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references posts on delete cascade,
  author_id  uuid not null references profiles on delete cascade,
  body       text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index comments_post_idx on comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. 카운터 동기화 (§3.2 — 홈에서 count(*) 를 N번 돌리지 않기 위한 비정규화)
-- ---------------------------------------------------------------------------

create or replace function sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  end if;
  update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

create trigger likes_sync_count
  after insert or delete on likes
  for each row execute function sync_like_count();

-- 댓글은 소프트 삭제(§3.2)라서 INSERT/DELETE 만으로는 부족하다.
-- deleted_at 이 채워지는 UPDATE 도 카운터를 내려야 한다.
create or replace function sync_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      update posts set comment_count = comment_count + 1 where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
    return old;
  end if;

  -- UPDATE: 삭제 상태가 바뀔 때만 반영
  if old.deleted_at is null and new.deleted_at is not null then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
  elsif old.deleted_at is not null and new.deleted_at is null then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  end if;
  return new;
end;
$$;

create trigger comments_sync_count
  after insert or update or delete on comments
  for each row execute function sync_comment_count();

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_touch_updated_at
  before update on posts
  for each row execute function touch_updated_at();

-- published 로 넘어가는 순간 published_at 을 박는다.
-- 애플리케이션이 잊어도 피드 인덱스가 비지 않도록 DB 에서 보장한다.
create or replace function stamp_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger posts_stamp_published_at
  before insert or update on posts
  for each row execute function stamp_published_at();

-- ---------------------------------------------------------------------------
-- 4. RLS (§5.3 — 나중에 켜는 게 아니라 처음부터 켠다)
-- ---------------------------------------------------------------------------

-- 정책 안에서 profiles 를 다시 select 하면 profiles 정책이 재귀한다.
-- security definer 함수로 끊는다.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

alter table profiles enable row level security;
alter table posts    enable row level security;
alter table likes    enable row level security;
alter table comments enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_read_all on profiles
  for select using (true);

create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- posts ---------------------------------------------------------------------
-- 발행글은 누구나. 초안·숨김은 작성자와 관리자만 (§5.2).
create policy posts_read_published on posts
  for select using (
    status = 'published'
    or author_id = auth.uid()
    or is_admin()
  );

create policy posts_insert_own on posts
  for insert with check (author_id = auth.uid());

create policy posts_update_own on posts
  for update using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());

create policy posts_delete_own on posts
  for delete using (author_id = auth.uid());

-- likes ---------------------------------------------------------------------
-- 주의: 비로그인 좋아요는 여기에 정책을 만들면 안 된다.
-- anon 키는 클라이언트에 노출되므로, actor_key 를 난수로 바꿔가며 무제한
-- 삽입이 가능해진다. 비로그인 경로는 반드시 서버 액션(service role)만 통과시킨다.
-- service role 은 RLS 를 우회하므로 아래 정책은 로그인 사용자만 다룬다.
create policy likes_read_all on likes
  for select using (true);

create policy likes_insert_self on likes
  for insert with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and actor_key = auth.uid()::text
  );

create policy likes_delete_self on likes
  for delete using (
    auth.uid() is not null
    and actor_key = auth.uid()::text
  );

-- comments ------------------------------------------------------------------
create policy comments_read_visible on comments
  for select using (deleted_at is null or author_id = auth.uid() or is_admin());

create policy comments_insert_self on comments
  for insert with check (auth.uid() is not null and author_id = auth.uid());

create policy comments_update_own on comments
  for update using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());
