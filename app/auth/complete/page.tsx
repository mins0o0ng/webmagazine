import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CompleteForm } from '@/components/auth/CompleteForm';
import styles from '@/components/auth/auth.module.css';
import { currentProfile, currentUser } from '@/lib/auth';

export const metadata: Metadata = { title: '가입 마무리', robots: { index: false } };

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  // 이미 profile 이 있으면 여기 있을 이유가 없다.
  if (await currentProfile()) redirect('/');

  const params = await searchParams;

  return (
    <div className="page">
      <div className={styles.wrap}>
        <CompleteForm handleTaken={params.error === 'handle'} />
      </div>
    </div>
  );
}
