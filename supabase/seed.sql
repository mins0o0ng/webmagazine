-- M1 시드
--
-- 왜 필요한가: posts.author_id 는 not null 이고 profiles → auth.users 를 참조한다.
-- M1 은 인증이 없으므로(관리자 비밀번호 한 개로 /write 를 막는다) auth 유저가
-- 0명이면 글을 단 한 건도 삽입할 수 없다. 기획안 M1 체크리스트에 이 단계가 빠져 있다.
--
-- 순서:
--   1. Supabase 대시보드 Authentication → Users → Add user 로 관리자 계정을 만든다.
--   2. 생성된 UUID 를 아래 자리에 넣고 이 파일을 실행한다.
--   3. 그 주소로 /login 에서 매직링크를 받아 로그인하면 편집실(/editor)이 열린다.
--
-- M2 에서 매직링크가 붙으면 이 계정이 그대로 정상 로그인 계정이 된다. 버리는 작업이 아니다.
--
-- M2-1: ADMIN_AUTHOR_ID 는 더 이상 쓰이지 않는다(글의 필자가 세션에서 나온다).
-- 하지만 이 계정 자체는 여전히 필요하다 — 편집실(/editor)에 들어가 다른 사람을
-- 초대할 수 있는 유일한 계정이고, is_admin 은 애플리케이션에서 만들 수 없다.
-- can_write 는 is_admin 이 켜져 있으면 없어도 되지만(may_write() 가 둘 다 본다),
-- 편집실 명단에서 상태가 헷갈리지 않도록 함께 켜둔다.

insert into profiles (id, handle, display_name, bio, is_admin, can_write)
values (
  '7d0fbc0a-1f80-4e7d-9786-718149154d3e',  -- ← 1단계에서 만든 UUID 로 교체
  'editor',
  '편집장',
  null,
  true,
  true
)
on conflict (id) do update
  set handle       = excluded.handle,
      display_name = excluded.display_name,
      is_admin     = excluded.is_admin,
      can_write    = excluded.can_write;
