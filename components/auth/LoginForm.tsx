'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestLoginLink, type AuthState } from '@/app/auth/actions';
import styles from './auth.module.css';

export function LoginForm({ next, linkFailed }: { next: string; linkFailed: boolean }) {
  const [state, formAction] = useActionState<AuthState, FormData>(requestLoginLink, {});

  if (state.sent) return <Sent email={state.sent} />;

  return (
    <>
      <p className="kicker">LOG IN</p>
      <h1 className={styles.title}>돌아오셨군요</h1>
      <p className={styles.lede}>
        이메일로 로그인 링크를 보냅니다. 비밀번호는 쓰지 않습니다.
      </p>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />

        {linkFailed && (
          <p className={styles.error} role="alert">
            링크가 만료되었거나 이미 사용되었습니다. 다시 받아 주세요.
          </p>
        )}
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={styles.input}
            autoComplete="email"
            required
          />
        </div>

        <Submit>로그인 링크 받기</Submit>
      </form>

      <p className={styles.alt}>
        처음이신가요?{' '}
        <Link href="/signup" className={styles.altLink}>
          가입하기
        </Link>
      </p>
    </>
  );
}

export function Sent({ email }: { email: string }) {
  return (
    <div className={styles.sent}>
      <h2 className={styles.sentTitle}>메일을 보냈습니다</h2>
      <p className={styles.sentBody}>
        <strong>{email}</strong> 으로 링크를 보냈습니다. 링크는 한 번만 쓸 수 있고
        잠시 뒤 만료됩니다.
        <br />
        메일이 보이지 않으면 스팸함을 확인해 주세요.
      </p>
    </div>
  );
}

export function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {children}
    </button>
  );
}
