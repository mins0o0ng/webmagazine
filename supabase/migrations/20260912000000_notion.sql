-- applied-if: select exists (select 1 from information_schema.columns where table_name='posts' and column_name='notion_page_id')
-- M2-4 노션 자동 동기화
--
-- 노션의 "웹매거진 원고" 데이터베이스를 사이트로 단방향 복제한다.
-- 원본은 노션이고, 사이트는 사본이다. 반대 방향은 없다.
--
-- 단방향으로 못박는 이유: 양쪽에서 고칠 수 있게 두면 다음 동기화가 사이트 수정을
-- 말없이 덮어쓴다. 그래서 notion_page_id 가 있는 글은 /write 에서 편집을 막고,
-- "노션에서 고치세요" 라고 안내한다.
--
-- 이 파일은 몇 번을 돌려도 결과가 같다.

-- ---------------------------------------------------------------------------
-- 1. 어느 노션 페이지에서 왔는가
-- ---------------------------------------------------------------------------

alter table posts
  add column if not exists notion_page_id  text,
  add column if not exists notion_synced_at timestamptz;

-- upsert 의 기준이 된다. 같은 노션 페이지가 두 번 들어오면 새 글이 아니라 수정이다.
create unique index if not exists posts_notion_page_idx
  on posts (notion_page_id)
  where notion_page_id is not null;

comment on column posts.notion_page_id is
  '이 글의 원본 노션 페이지. 값이 있으면 사이트에서 편집할 수 없다 — '
  '다음 동기화가 덮어쓰기 때문이다.';

-- 컬럼 GRANT 에 넣지 않는다. 동기화는 service_role 로 돌고, 로그인 사용자가
-- 이 값을 직접 쓸 일은 없다. 쓸 수 있으면 남의 글을 자기 노션 페이지에
-- 묶어 다음 동기화 때 통째로 덮어쓰는 경로가 생긴다.
revoke insert, update on posts from anon, authenticated;
grant insert (author_id, title, deck, body, category, status, thumbnail_url, thumbnail_ratio)
  on posts to authenticated;
grant update (title, deck, body, category, status, thumbnail_url, thumbnail_ratio)
  on posts to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 이미지 보관함
-- ---------------------------------------------------------------------------
--
-- 노션이 호스팅하는 이미지 URL 은 서명된 링크라 한 시간이면 만료된다. 그대로
-- 저장하면 동기화 직후에는 멀쩡하다가 한 시간 뒤 전부 깨진다. 그래서 동기화할 때
-- 이미지를 여기로 복사하고, 본문에는 이 버킷의 영구 주소를 넣는다.
--
-- public = true 다. 지면에 나갈 사진이라 누구나 읽어야 하고, 공개 버킷은 정책
-- 없이도 읽기가 열린다. 쓰기는 service_role 만 한다(anon 키로는 업로드 불가).

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('post-images', 'post-images', true)
    on conflict (id) do nothing;
  else
    -- 로컬 검증용 Postgres 에는 storage 스키마가 없다. 마이그레이션을 세우지 않는다.
    raise notice 'storage 스키마가 없어 post-images 버킷을 건너뜁니다.';
  end if;
end $$;

-- 확인은 supabase/check_rls.sql 로 한다.
