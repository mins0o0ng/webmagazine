import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { NeedsInvite } from '@/components/NeedsInvite';
import { PostEditor } from '@/components/PostEditor';
import { getEditablePost } from '@/lib/authorPosts';
import { canWrite, currentProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '글 수정', robots: { index: false } };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect('/auth/complete');
  if (!canWrite(profile)) return <NeedsInvite />;

  const { id: raw } = await params;
  if (!/^\d+$/.test(raw)) notFound();

  // RLS 가 소유권을 건다. 남의 초안은 아예 안 읽히고, 남의 발행글은 읽히지만
  // 저장이 posts_update_own 에서 막힌다. 관리자는 둘 다 통과한다.
  const post = await getEditablePost(Number(raw));
  if (!post) notFound();

  // 남의 발행글을 편집자가 아닌 사람이 연 경우. 폼을 보여주고 저장에서 막는 것보다
  // 여기서 끊는 편이 정직하다.
  if (post.author_id !== profile.id && !profile.is_admin) notFound();

  return <PostEditor post={post} />;
}
