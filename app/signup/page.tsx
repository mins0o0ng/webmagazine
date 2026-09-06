import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/SignupForm';
import styles from '@/components/auth/auth.module.css';

export const metadata: Metadata = { title: '가입', robots: { index: false } };

export default function SignupPage() {
  return (
    <div className="page">
      <div className={styles.wrap}>
        <SignupForm />
      </div>
    </div>
  );
}
