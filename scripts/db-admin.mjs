#!/usr/bin/env node
/**
 * 편집장 지정.
 *
 *   npm run db:admin -- me@example.com
 *   npm run db:admin -- me@example.com --handle jiwon --name 배지원
 *
 * 하는 일: 그 주소의 계정이 없으면 만들고, profile 이 없으면 만들고,
 * is_admin 과 can_write 를 켠다. 이미 다 돼 있으면 아무것도 바꾸지 않는다.
 *
 * 왜 필요한가: is_admin 은 애플리케이션 어디에서도 켤 수 없다 — 앱에서 편집장을
 * 만들 수 있으면 그 경로가 곧 권한 상승 경로가 되기 때문이다. 그래서 첫 편집장은
 * 반드시 앱 바깥에서 만들어야 하고, 그 계정이 없으면 아무도 /editor 에 들어가지
 * 못해 누구도 기고 권한을 받을 수 없다.
 *
 * 지금까지 이 일은 "대시보드에서 계정 만들기 → UUID 복사 → seed.sql 편집 →
 * SQL Editor 에서 실행" 네 단계였다. 여기서는 한 줄이다.
 *
 * service_role 키만 있으면 된다. DATABASE_URL 은 필요 없다.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error(
    '환경변수가 필요합니다: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n' +
      '  .env.local 에 넣으면 npm run db:admin 이 알아서 읽습니다.',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('사용법: npm run db:admin -- me@example.com [--handle 핸들] [--name 이름]');
  process.exit(2);
}

/* lib/auth.ts 의 HANDLE_PATTERN·RESERVED 와 같은 규칙. 여기서 import 하지 않는 이유는
 * 그 파일이 next/headers 를 끌고 오기 때문이다(순수 노드 스크립트에서 못 쓴다). */
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set([
  'admin', 'administrator', 'editor', 'official', 'staff', 'support', 'help',
  'about', 'login', 'logout', 'signup', 'write', 'me', 'auth', 'api', 'feed',
  'rss', 'category', 'legal', 'terms', 'privacy', 'null', 'undefined',
]);

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

/** listUsers 에 이메일 필터가 없다. 페이지를 넘기며 찾는다. */
async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`계정 목록을 읽지 못했습니다: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

function defaultHandle(addr) {
  const base = addr.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  return base.length < 3 ? `${base}_editor`.slice(0, 20) : base.slice(0, 20);
}

async function main() {
  // 1. 계정
  let user = await findUserByEmail(email);

  if (user) {
    console.log(`계정 있음   ${email}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw new Error(`계정을 만들지 못했습니다: ${error.message}`);
    user = data.user;
    console.log(`계정 생성   ${email}`);
  }

  // 2. profile
  const { data: existing, error: readError } = await db
    .from('profiles')
    .select('id, handle, display_name, is_admin, can_write')
    .eq('id', user.id)
    .maybeSingle();
  if (readError) throw new Error(`profile 을 읽지 못했습니다: ${readError.message}`);

  if (existing) {
    if (existing.is_admin && existing.can_write) {
      console.log(`이미 편집장  @${existing.handle} (${existing.display_name}) — 바꿀 것 없음`);
      return;
    }
    const { error } = await db
      .from('profiles')
      .update({ is_admin: true, can_write: true })
      .eq('id', user.id);
    if (error) throw new Error(`권한을 켜지 못했습니다: ${error.message}`);
    console.log(`편집장 지정  @${existing.handle} (${existing.display_name})`);
    return;
  }

  const handle = (flag('handle') ?? defaultHandle(email)).toLowerCase();
  const name = flag('name') ?? handle;

  if (!HANDLE_PATTERN.test(handle)) {
    throw new Error(
      `핸들이 규칙에 맞지 않습니다: "${handle}"\n` +
        '  영소문자·숫자·밑줄 3~20자. --handle 로 직접 지정하세요.',
    );
  }
  // 예약어는 앱에서 막지만 여기는 service_role 이라 그냥 통과한다. 직접 확인한다.
  if (RESERVED.has(handle)) {
    throw new Error(
      `"${handle}" 은 예약된 핸들입니다(라우트와 겹치거나 사칭 소지).\n` +
        '  --handle 로 다른 값을 주세요.',
    );
  }

  const { error } = await db
    .from('profiles')
    .insert({ id: user.id, handle, display_name: name, is_admin: true, can_write: true });

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        `핸들 "${handle}" 은 이미 쓰이고 있습니다. --handle 로 다른 값을 주세요.`,
      );
    }
    throw new Error(`profile 을 만들지 못했습니다: ${error.message}`);
  }

  console.log(`편집장 생성  @${handle} (${name})`);
  console.log('');
  console.log(`이제 /login 에서 ${email} 로 매직링크를 받아 로그인하면`);
  console.log('마스트헤드에 "쓰기" 가 뜨고 /editor 가 열립니다.');
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
