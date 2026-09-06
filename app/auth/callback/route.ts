import { NextResponse, type NextRequest } from 'next/server';
import { safeNext, validateDisplayName, validateHandle } from '@/lib/auth';
import { sessionClient } from '@/lib/supabase';

/**
 * 매직링크가 돌아오는 곳.
 *
 * Supabase 가 메일의 링크를 검증한 뒤 `?code=` 를 달고 여기로 보낸다.
 * 그 코드를 세션으로 바꾸고, 가입이라면 profile 을 만든 다음 원래 가려던 곳으로 보낸다.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return redirectTo(url, '/login', { error: 'link' });
  }

  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    // 만료됐거나 이미 쓴 링크. 매직링크는 일회용이다.
    console.error('[auth] exchangeCodeForSession failed:', error?.message);
    return redirectTo(url, '/login', { error: 'link' });
  }

  const user = data.user;

  // 이미 profile 이 있으면 로그인이다.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return redirectTo(url, next);

  // profile 이 없으면 가입이다. /signup 에서 담아둔 값으로 만든다.
  const meta = user.user_metadata ?? {};
  const handle = validateHandle(String(meta.handle ?? ''));
  const name = validateDisplayName(String(meta.display_name ?? ''));

  if (!handle.ok || !name.ok) {
    // /login 으로 들어온 신규 계정이거나 메타데이터가 비었다. 직접 고르게 한다.
    return redirectTo(url, '/auth/complete');
  }

  const { error: insertError } = await supabase
    .from('profiles')
    .insert({ id: user.id, handle: handle.handle, display_name: name.name });

  if (insertError) {
    // 메일을 확인하는 사이 누군가 같은 핸들을 가져갔다. 다시 고르게 한다.
    return redirectTo(url, '/auth/complete', { error: 'handle' });
  }

  return redirectTo(url, next);
}

function redirectTo(base: URL, pathname: string, params?: Record<string, string>) {
  const target = new URL(base);
  target.pathname = pathname;
  target.search = '';
  for (const [k, v] of Object.entries(params ?? {})) target.searchParams.set(k, v);
  return NextResponse.redirect(target);
}
