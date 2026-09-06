import type { Metadata } from 'next';
import { PasswordGate } from '@/components/PasswordGate';
import { PostEditor } from '@/components/PostEditor';
import { isUnlocked } from '@/lib/adminGate';

// 로그인 상태에 따라 화면이 갈리므로 동적 렌더링(§2.3).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '새 글', robots: { index: false } };

export default async function WritePage() {
  if (!(await isUnlocked())) return <PasswordGate />;
  return <PostEditor />;
}
