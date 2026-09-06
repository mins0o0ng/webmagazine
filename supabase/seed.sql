-- M1 시드
--
-- 왜 필요한가: posts.author_id 는 not null 이고 profiles → auth.users 를 참조한다.
-- M1 은 인증이 없으므로(관리자 비밀번호 한 개로 /write 를 막는다) auth 유저가
-- 0명이면 글을 단 한 건도 삽입할 수 없다. 기획안 M1 체크리스트에 이 단계가 빠져 있다.
--
-- 순서:
--   1. Supabase 대시보드 Authentication → Users → Add user 로 관리자 계정을 만든다.
--   2. 생성된 UUID 를 아래 :admin_id 자리에 넣고 이 파일을 실행한다.
--   3. 같은 UUID 를 .env.local 의 ADMIN_AUTHOR_ID 에 넣는다.
--
-- M2 에서 매직링크가 붙으면 이 계정이 그대로 정상 로그인 계정이 된다. 버리는 작업이 아니다.

insert into profiles (id, handle, display_name, bio, is_admin)
values (
  '7d0fbc0a-1f80-4e7d-9786-718149154d3e',  -- ← 1단계에서 만든 UUID 로 교체
  'editor',
  '편집장',
  null,
  true
)
on conflict (id) do update
  set handle       = excluded.handle,
      display_name = excluded.display_name,
      is_admin     = excluded.is_admin;
