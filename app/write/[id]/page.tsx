import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PasswordGate } from '@/components/PasswordGate';
import { PostEditor } from '@/components/PostEditor';
import { isUnlocked } from '@/lib/adminGate';
import { getAnyPost } from '@/lib/adminPosts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '글 수정', robots: { index: false } };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isUnlocked())) return <PasswordGate />;

  const { id: raw } = await params;
  if (!/^\d+$/.test(raw)) notFound();

  const post = await getAnyPost(Number(raw));
  if (!post) notFound();

  return <PostEditor post={post} />;
}
