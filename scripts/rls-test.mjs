#!/usr/bin/env node
/**
 * RLS 정책 우회 테스트.
 *
 * 기획안 §6 M2 의 완료 기준을 그대로 검사한다:
 *   "본인이 아닌 계정으로 남의 글 수정 API 를 직접 호출했을 때 거부된다."
 *
 * 실행:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run test:rls
 *
 * 실제 Supabase 프로젝트에 붙어 계정 두 개를 만들고, 끝나면 지운다.
 * 개발용 프로젝트에서 돌릴 것 — 운영 DB 에 테스트 계정과 글이 잠깐 생긴다.
 *
 * 주의: RLS 가 막은 UPDATE/DELETE 는 오류가 아니라 "0행 영향"으로 돌아온다.
 * 그래서 모든 쓰기 검사는 .select() 를 붙여 반환된 행이 비었는지로 판정한다.
 * 이걸 오류 여부로만 보면 전부 통과한 것처럼 보인다.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    '환경변수가 필요합니다: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

/** 계정 하나를 만들고 profile 까지 붙인 뒤, 그 사람으로 로그인된 anon 클라이언트를 준다. */
async function makeUser(tag) {
  const email = `rls-${tag}-${randomUUID().slice(0, 8)}@example.test`;
  const password = randomUUID();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(`계정 생성 실패(${tag}): ${createError.message}`);

  const id = created.user.id;
  const handle = `rls${tag}${id.slice(0, 6).replace(/[^a-z0-9]/g, '0')}`;

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id, handle, display_name: `테스트${tag}` });
  if (profileError) throw new Error(`profile 생성 실패(${tag}): ${profileError.message}`);

  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`로그인 실패(${tag}): ${signInError.message}`);

  return { id, handle, client };
}

async function main() {
  console.log('RLS 정책 우회 테스트\n');

  const a = await makeUser('a');
  const b = await makeUser('b');
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });

  const createdPostIds = [];

  try {
    // A 가 발행글과 초안을 하나씩 만든다.
    const { data: published, error: pubErr } = await a.client
      .from('posts')
      .insert({
        author_id: a.id,
        title: 'A 의 발행글',
        deck: '부제',
        body: '본문',
        category: 'essay',
        status: 'published',
      })
      .select('id')
      .single();
    if (pubErr) throw new Error(`A 발행글 생성 실패: ${pubErr.message}`);
    createdPostIds.push(published.id);

    const { data: draft, error: draftErr } = await a.client
      .from('posts')
      .insert({
        author_id: a.id,
        title: 'A 의 초안',
        deck: '부제',
        body: '본문',
        category: 'essay',
        status: 'draft',
      })
      .select('id')
      .single();
    if (draftErr) throw new Error(`A 초안 생성 실패: ${draftErr.message}`);
    createdPostIds.push(draft.id);

    console.log('posts');

    // ── 기획안 M2 완료 기준 ────────────────────────────────────────────
    {
      const { data } = await b.client
        .from('posts')
        .update({ title: 'B 가 고침' })
        .eq('id', published.id)
        .select('id');
      check('B 는 A 의 글을 수정할 수 없다  ← M2 완료 기준', (data ?? []).length === 0);
    }

    {
      const { data } = await b.client
        .from('posts')
        .delete()
        .eq('id', published.id)
        .select('id');
      check('B 는 A 의 글을 삭제할 수 없다', (data ?? []).length === 0);
    }

    {
      const { data } = await b.client.from('posts').select('id').eq('id', draft.id);
      check('B 는 A 의 초안을 읽을 수 없다', (data ?? []).length === 0);
    }

    {
      const { data } = await anon.from('posts').select('id').eq('id', draft.id);
      check('비로그인은 초안을 읽을 수 없다', (data ?? []).length === 0);
    }

    {
      const { data } = await anon.from('posts').select('id').eq('id', published.id);
      check('비로그인도 발행글은 읽을 수 있다', (data ?? []).length === 1);
    }

    {
      const { data, error } = await anon
        .from('posts')
        .insert({
          author_id: a.id,
          title: '비로그인이 쓴 글',
          deck: '부제',
          body: '본문',
          category: 'essay',
          status: 'published',
        })
        .select('id');
      check('비로그인은 글을 쓸 수 없다', Boolean(error) || (data ?? []).length === 0);
      if (data?.[0]) createdPostIds.push(data[0].id);
    }

    {
      // 남의 이름으로 글을 쓰는 경로. author_id 만 바꾸면 되는 가장 흔한 시도다.
      const { data, error } = await b.client
        .from('posts')
        .insert({
          author_id: a.id,
          title: 'B 가 A 이름으로 쓴 글',
          deck: '부제',
          body: '본문',
          category: 'essay',
          status: 'published',
        })
        .select('id');
      check('B 는 A 를 필자로 지정해 글을 쓸 수 없다', Boolean(error) || (data ?? []).length === 0);
      if (data?.[0]) createdPostIds.push(data[0].id);
    }

    console.log('\nprofiles');

    {
      const { data } = await b.client
        .from('profiles')
        .update({ display_name: '탈취됨' })
        .eq('id', a.id)
        .select('id');
      check('B 는 A 의 프로필을 고칠 수 없다', (data ?? []).length === 0);
    }

    {
      const { data, error } = await b.client
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', b.id)
        .select('is_admin');
      // 정책은 본인 행 수정을 허용하므로 is_admin 을 스스로 켤 수 있다.
      // 이건 현재 스키마의 실제 구멍이다 — 통과하면 안 된다.
      const escalated = !error && data?.[0]?.is_admin === true;
      check(
        'B 는 스스로 관리자가 될 수 없다',
        !escalated,
        escalated
          ? 'profiles_update_self 가 is_admin 컬럼을 막지 않는다. 컬럼 단위 제한이나 트리거가 필요하다.'
          : '',
      );
      if (escalated) {
        await admin.from('profiles').update({ is_admin: false }).eq('id', b.id);
      }
    }

    console.log('\nlikes');

    {
      // 기획안 §3.2 의 비로그인 좋아요를 anon 키로 직접 시도한다.
      // 열려 있으면 actor_key 를 난수로 바꿔가며 무제한 삽입이 가능하다.
      const { data, error } = await anon
        .from('likes')
        .insert({ post_id: published.id, actor_key: randomUUID() })
        .select('post_id');
      check('비로그인은 좋아요를 직접 넣을 수 없다', Boolean(error) || (data ?? []).length === 0);
    }

    {
      const { data, error } = await b.client
        .from('likes')
        .insert({ post_id: published.id, actor_key: a.id, user_id: a.id })
        .select('post_id');
      check('B 는 A 인 척 좋아요를 넣을 수 없다', Boolean(error) || (data ?? []).length === 0);
    }

    {
      const { data, error } = await b.client
        .from('likes')
        .insert({ post_id: published.id, actor_key: b.id, user_id: b.id })
        .select('post_id');
      check('B 는 본인 좋아요를 넣을 수 있다', !error && (data ?? []).length === 1);
    }

    console.log('\ncomments');

    {
      const { data, error } = await anon
        .from('comments')
        .insert({ post_id: published.id, author_id: a.id, body: '비로그인 댓글' })
        .select('id');
      check('비로그인은 댓글을 쓸 수 없다', Boolean(error) || (data ?? []).length === 0);
    }

    {
      const { data, error } = await b.client
        .from('comments')
        .insert({ post_id: published.id, author_id: a.id, body: 'A 이름으로 쓴 댓글' })
        .select('id');
      check('B 는 A 이름으로 댓글을 쓸 수 없다', Boolean(error) || (data ?? []).length === 0);
    }
  } finally {
    // 정리. 글은 author cascade 로 함께 지워지지만 혹시 남은 것을 먼저 치운다.
    if (createdPostIds.length > 0) {
      await admin.from('posts').delete().in('id', createdPostIds);
    }
    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  }

  console.log(`\n${passed} 통과, ${failed} 실패`);
  if (failed > 0) {
    console.log('\n실패한 항목은 RLS 정책의 실제 구멍입니다. 배포 전에 막으세요.');
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n테스트를 끝내지 못했습니다: ${err.message}`);
  process.exit(2);
});
