import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NeedsInvite } from '@/components/NeedsInvite';
import { PostEditor } from '@/components/PostEditor';
import { canWrite, currentProfile } from '@/lib/auth';

// 로그인 상태에 따라 화면이 갈리므로 동적 렌더링(§2.3).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '새 글', robots: { index: false } };

export default async function WritePage() {
  // 비로그인은 미들웨어가 이미 /login 으로 돌린다. 여기 도달했는데 profile 이
  // 없다는 것은 가입이 덜 끝났다는 뜻이다 — /auth/complete 가 핸들을 받는다.
  // (혹시 미들웨어를 지나온 비로그인이라면 /auth/complete 가 다시 /login 으로 보낸다.)
  const profile = await currentProfile();
  if (!profile) redirect('/auth/complete');

  if (!canWrite(profile)) return <NeedsInvite />;

  return <PostEditor />;
}
