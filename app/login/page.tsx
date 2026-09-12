import type { Metadata } from 'next';
import { KeyForm } from '@/components/auth/KeyForm';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeNext } from '@/lib/auth';
import { keyLoginEmail } from '@/lib/keyLogin';
import styles from '@/components/auth/auth.module.css';

export const metadata: Metadata = { title: '로그인', robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  // ADMIN_EMAIL 을 지우면 이 화면과 서버 액션이 함께 사라진다(auth/actions.ts).
  const keyEnabled = keyLoginEmail() !== null;

  return (
    <div className="page">
      <div className={styles.wrap}>
        <LoginForm next={next} linkFailed={params.error === 'link'} />
        {keyEnabled && <KeyForm next={next} />}
      </div>
    </div>
  );
}
