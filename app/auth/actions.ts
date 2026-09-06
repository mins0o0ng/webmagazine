'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  safeNext,
  validateDisplayName,
  validateEmail,
  validateHandle,
} from '@/lib/auth';
import { adminClient, sessionClient } from '@/lib/supabase';

export interface AuthState {
  error?: string;
  sent?: string;
}

/** 매직링크가 돌아올 주소. 배포 도메인이 설정돼 있으면 그 값을, 없으면 요청 호스트를 쓴다. */
async function origin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/* --- 로그인 -----------------------------------------------------------
 * 매직링크만 쓴다(기획안 §5.1). 비밀번호가 없으면 재설정 플로우도 없다. */

export async function requestLoginLink(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = validateEmail(String(form.get('email') ?? ''));
  if (!email.ok) return { error: email.error };

  const next = safeNext(String(form.get('next') ?? '/'));
  const supabase = await sessionClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: email.email,
    options: {
      // 가입은 /signup 에서만. 여기서 열어두면 핸들 없는 계정이 생긴다.
      shouldCreateUser: false,
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    // 어떤 이메일이 가입돼 있는지 알려주지 않는다. 계정 존재 여부를 흘리는
    // 가장 흔한 경로가 로그인 오류 메시지다.
    console.error('[auth] signInWithOtp failed:', error.message);
  }

  // 성공·실패와 무관하게 같은 화면을 보여준다.
  return { sent: email.email };
}

/* --- 가입 ------------------------------------------------------------- */

export async function requestSignupLink(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = validateEmail(String(form.get('email') ?? ''));
  if (!email.ok) return { error: email.error };

  const handle = validateHandle(String(form.get('handle') ?? ''));
  if (!handle.ok) return { error: handle.error };

  const name = validateDisplayName(String(form.get('display_name') ?? ''));
  if (!name.ok) return { error: name.error };

  // 링크를 누르기 전에 미리 알려준다. 확정 예약은 아니다 — 메일을 확인하는 사이
  // 다른 사람이 같은 핸들을 가져갈 수 있고, 그 경우는 /auth/complete 가 받는다.
  if (await handleTaken(handle.handle)) {
    return { error: '이미 쓰이고 있는 핸들입니다.' };
  }

  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.email,
    options: {
      shouldCreateUser: true,
      // 링크를 누른 뒤 profile 을 만들 때 쓴다. 사용자가 고친 값이 아니라
      // 여기 담긴 값을 서버가 다시 검증한다.
      data: { handle: handle.handle, display_name: name.name },
      emailRedirectTo: `${await origin()}/auth/callback?next=/`,
    },
  });

  if (error) {
    console.error('[auth] signup signInWithOtp failed:', error.message);
  }

  return { sent: email.email };
}

/* --- 핸들 재선택 (가입 중 충돌했을 때) ---------------------------------- */

export async function completeProfile(_prev: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };

  const handle = validateHandle(String(form.get('handle') ?? ''));
  if (!handle.ok) return { error: handle.error };

  const name = validateDisplayName(String(form.get('display_name') ?? ''));
  if (!name.ok) return { error: name.error };

  // insert 는 본인 행만 허용된다(RLS profiles_insert_self).
  const { error } = await supabase
    .from('profiles')
    .insert({ id: user.id, handle: handle.handle, display_name: name.name });

  if (error) {
    // 23505 = unique_violation. 미리 검사해도 동시 가입에서는 여기로 온다.
    if (error.code === '23505') return { error: '이미 쓰이고 있는 핸들입니다.' };
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath('/');
  redirect('/');
}

/* 로그아웃은 서버 액션이 아니라 브라우저 클라이언트에서 처리한다
 * (components/auth/AuthNav.tsx). 마스트헤드가 클라이언트 컴포넌트이기도 하고,
 * 서버 액션으로 만들면 revalidatePath 가 로그아웃할 때마다 ISR 캐시를 비운다. */

/* --- 보조 ------------------------------------------------------------- */

/**
 * 핸들 사용 여부. profiles 는 전체 공개라 anon 으로도 읽히지만, 이 검사는
 * 로그인 전에 돌아야 하므로 세션과 무관한 service role 로 확인한다.
 */
async function handleTaken(handle: string): Promise<boolean> {
  const { data } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('handle', handle)
    .maybeSingle();
  return data !== null;
}
