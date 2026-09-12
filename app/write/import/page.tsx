import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ImportForm } from '@/components/ImportForm';
import { NeedsInvite } from '@/components/NeedsInvite';
import { canWrite, currentProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '원고 가져오기', robots: { index: false } };

export default async function ImportPage() {
  // /write 와 같은 게이트다. 미들웨어가 비로그인을 이미 걸렀다.
  const profile = await currentProfile();
  if (!profile) redirect('/auth/complete');
  if (!canWrite(profile)) return <NeedsInvite />;

  return <ImportForm />;
}
