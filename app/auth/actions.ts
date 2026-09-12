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
import { claimInvite } from '@/lib/contributors';
import { keyLoginEmail } from '@/lib/keyLogin';
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

/* --- 편집실 열쇠 (임시) -------------------------------------------------
 *
 * 매직링크 왕복 없이 비밀번호 하나로 편집장 계정에 로그인한다.
 * ADMIN_EMAIL 이 설정돼 있을 때만 존재하고, 지우면 화면과 이 액션이 함께 사라진다.
 *
 * 왜 "비밀번호를 맞히면 관리자 권한을 준다" 가 아니라 "그 계정으로 로그인한다"
 * 인가. 전자는 M2-1 이 막은 자가 승격 경로를 애플리케이션에 다시 뚫는 것이고,
 * 그러면 auth.uid() 가 비어 글의 필자를 세션에서 꺼낼 수 없어 service_role 쓰기가
 * 되살아난다. 후자는 진짜 세션을 만들기 때문에 RLS·초대제·컬럼 GRANT 가 전부
 * 그대로 작동한다. 사람이 겪는 절차는 같다 — 비밀번호 한 칸.
 *
 * 한계를 분명히 해둔다. 이건 부트스트랩용 지름길이지 인증 설계가 아니다.
 * 열쇠가 새면 지면 전체가 넘어간다. 다른 사람을 초대해 그들이 자기 계정으로
 * 로그인하기 시작하면 ADMIN_EMAIL 을 지울 것.
 */

export async function signInWithKey(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = keyLoginEmail();
  // 환경변수를 지우면 화면뿐 아니라 이 경로도 함께 닫힌다. 화면만 감추면
  // 액션은 여전히 살아 있어 아무나 직접 호출할 수 있다.
  if (!email) return { error: '열쇠 로그인이 꺼져 있습니다.' };

  const password = String(form.get('password') ?? '');
  if (!password) return { error: '열쇠를 입력하세요.' };

  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[auth] key login failed:', error.message);
    // 무제한으로 빠르게 시도하는 것만 늦춘다. 진짜 방어는 Supabase 쪽 인증
    // 요청 제한이고, 이건 그 앞에 두는 얇은 턱이다.
    await new Promise((r) => setTimeout(r, 700));
    return { error: '열쇠가 맞지 않습니다.' };
  }

  revalidatePath('/');
  redirect(safeNext(String(form.get('next') ?? '/')));
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

  // 콜백과 같은 처리다. 핸들이 겹쳐 이 화면으로 온 사람도 초대는 그대로 유효하다.
  const invited = await claimInvite(user.email, user.id);

  revalidatePath('/');
  redirect(invited ? '/write' : '/');
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
