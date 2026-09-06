import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 없습니다. .env.example 을 .env.local 로 복사해 채우세요.`,
    );
  }
  return value;
}

export const supabaseUrl = () => required('NEXT_PUBLIC_SUPABASE_URL');
export const supabaseAnonKey = () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY');

/**
 * 쿠키를 보지 않는 읽기 전용 클라이언트. anon 키를 쓰므로 RLS 가 그대로 적용된다.
 *
 * ISR 페이지(홈·카테고리·상세)는 반드시 이쪽을 쓴다. 쿠키를 읽는 순간 Next 가
 * 그 페이지를 동적 렌더링으로 바꿔버려 캐시가 통째로 사라진다.
 */
export function publicClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false },
  });
}

/**
 * 로그인 세션이 붙은 클라이언트. auth.uid() 가 채워지므로 RLS 정책이 사람 단위로 걸린다.
 * 서버 컴포넌트·서버 액션·라우트 핸들러에서 쓴다.
 */
export async function sessionClient(): Promise<SupabaseClient> {
  const store = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 토큰 갱신은 미들웨어가 담당하므로
          // 여기서 실패해도 세션은 유지된다.
        }
      },
    },
  });
}

/**
 * RLS 를 우회하는 서버 전용 클라이언트.
 *
 * 서버 액션과 라우트 핸들러에서만 호출할 것. 클라이언트 컴포넌트에서 import 하면
 * service role 키가 번들에 들어간다(기획안 §7 의 '높음' 리스크).
 */
export function adminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('adminClient() 는 서버에서만 호출할 수 있습니다.');
  }
  return createClient(supabaseUrl(), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}
