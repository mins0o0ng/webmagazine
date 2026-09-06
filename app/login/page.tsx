import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeNext } from '@/lib/auth';
import styles from '@/components/auth/auth.module.css';

export const metadata: Metadata = { title: '로그인', robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="page">
      <div className={styles.wrap}>
        <LoginForm next={safeNext(params.next)} linkFailed={params.error === 'link'} />
      </div>
    </div>
  );
}
