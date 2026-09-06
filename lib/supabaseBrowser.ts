import { createBrowserClient } from '@supabase/ssr';

/**
 * 브라우저용 클라이언트. anon 키만 쓰므로 노출되어도 되고 RLS 가 보호한다.
 *
 * 왜 필요한가: 마스트헤드의 로그인 상태를 서버에서 읽으면 cookies() 때문에
 * 그 페이지가 통째로 동적 렌더링이 된다. 홈과 카테고리는 ISR 이어야 하므로
 * (기획안 §2.3) 로그인 표시만 클라이언트에서 가져온다. 캐시된 지면에 개인 상태를
 * 섞지 않는다는 §2.3 의 원칙이 좋아요·댓글뿐 아니라 여기에도 적용된다.
 */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
