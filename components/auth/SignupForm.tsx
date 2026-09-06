'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestSignupLink, type AuthState } from '@/app/auth/actions';
import { Sent, Submit } from './LoginForm';
import styles from './auth.module.css';

export function SignupForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(requestSignupLink, {});

  if (state.sent) return <Sent email={state.sent} />;

  return (
    <>
      <p className="kicker">SIGN UP</p>
      <h1 className={styles.title}>여기 서기</h1>
      <p className={styles.lede}>읽고 쓰는 사람들의 자리에 이름을 올립니다.</p>

      <form action={formAction} className={styles.form}>
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

        <div className={styles.field}>
          <label className={styles.label} htmlFor="display_name">
            이름 <span className={styles.hint}>글에 표시됩니다. 본명이 아니어도 됩니다.</span>
          </label>
          <input
            id="display_name"
            name="display_name"
            className={styles.input}
            maxLength={20}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="handle">
            핸들 <span className={styles.hint}>주소에 쓰입니다. 영소문자·숫자·밑줄 3~20자.</span>
          </label>
          <input
            id="handle"
            name="handle"
            className={styles.input}
            pattern="[a-zA-Z0-9_]{3,20}"
            maxLength={20}
            required
          />
        </div>

        <Submit>가입 링크 받기</Submit>

        <p className={styles.legal}>
          가입하면 <Link href="/legal/terms">이용약관</Link>과{' '}
          <Link href="/legal/privacy">개인정보처리방침</Link>에 동의하는 것으로 봅니다.
        </p>
      </form>

      <p className={styles.alt}>
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className={styles.altLink}>
          로그인
        </Link>
      </p>
    </>
  );
}
