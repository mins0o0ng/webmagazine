import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 없습니다. .env.example 을 .env.local 로 복사해 채우세요.`,
    );
  }
  return value;
}

/**
 * 읽기 전용 클라이언트. anon 키를 쓰므로 RLS 가 그대로 적용된다.
 * 발행되지 않은 글은 이 클라이언트로 절대 읽히지 않는다 — 그게 정상 동작이다.
 */
export function publicClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

/**
 * RLS 를 우회하는 서버 전용 클라이언트.
 *
 * 서버 액션과 라우트 핸들러에서만 호출할 것. 클라이언트 컴포넌트에서 import 하면
 * service role 키가 번들에 들어간다(§7 의 '높음' 리스크). 아래 가드가 그 사고를
 * 빌드 타임이 아니라 최소한 첫 실행에서 잡아준다.
 */
export function adminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('adminClient() 는 서버에서만 호출할 수 있습니다.');
  }
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
}
