import type { User } from '@supabase/supabase-js';
import { sessionClient } from './supabase';
import type { Profile } from './types';

/**
 * 현재 로그인한 사용자.
 *
 * getSession() 이 아니라 getUser() 를 쓴다. getSession() 은 쿠키 안의 JWT 를
 * 검증 없이 반환하므로 "누구인지" 판단의 근거가 될 수 없다. 쿠키는 조작 가능하다.
 */
export async function currentUser(): Promise<User | null> {
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** 로그인 사용자의 profile. 로그인했지만 profile 이 아직 없으면 null. */
export async function currentProfile(): Promise<Profile | null> {
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile) ?? null;
}

/* --- 핸들 규칙 -------------------------------------------------------
 * DB 에도 같은 정규식이 CHECK 제약으로 걸려 있다(마이그레이션 2).
 * 여기서 먼저 막는 이유는 사람이 읽을 수 있는 문구를 주기 위해서다. */

export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

/** 라우트와 겹치거나 사칭 소지가 있는 핸들. /u/<handle> 밖에서도 쓰일 수 있어 미리 막는다. */
const RESERVED = new Set([
  'admin', 'administrator', 'editor', 'official', 'staff', 'support', 'help',
  'about', 'login', 'logout', 'signup', 'write', 'me', 'auth', 'api', 'feed',
  'rss', 'category', 'legal', 'terms', 'privacy', 'null', 'undefined',
]);

export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = raw.trim().toLowerCase();

  if (!handle) return { ok: false, error: '핸들을 입력하세요.' };
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      ok: false,
      error: '핸들은 영소문자·숫자·밑줄 3~20자입니다.',
    };
  }
  if (RESERVED.has(handle)) return { ok: false, error: '쓸 수 없는 핸들입니다.' };

  return { ok: true, handle };
}

export function validateDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1) return { ok: false, error: '이름을 입력하세요.' };
  if (name.length > 20) return { ok: false, error: '이름은 20자까지입니다.' };
  return { ok: true, name };
}

/** 아주 느슨한 형식 검사. 진짜 검증은 메일이 도착하는지로 이뤄진다. */
export function validateEmail(raw: string): { ok: true; email: string } | { ok: false; error: string } {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: '이메일 주소를 확인해 주세요.' };
  }
  return { ok: true, email };
}

/**
 * 로그인 후 돌아갈 경로. 열린 리다이렉트를 막기 위해 같은 사이트의 절대 경로만 통과시킨다.
 * `//evil.com` 이 프로토콜 상대 URL 로 해석되는 것도 함께 막는다.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}
