'use client';

import { useActionState } from 'react';
import { signInWithKey, type AuthState } from '@/app/auth/actions';
import { Submit } from './LoginForm';
import styles from './auth.module.css';

/**
 * 편집실 열쇠 — 임시 (M2-2).
 *
 * 매직링크 왕복 없이 비밀번호 한 칸으로 편집장 계정에 로그인한다.
 * ADMIN_EMAIL 이 설정돼 있을 때만 /login 에 나온다.
 *
 * 어느 계정으로 들어가는지는 화면에 적지 않는다. 로그인 화면은 비로그인도 보는
 * 곳이라 편집장 주소를 걸어두면 그 주소가 곧 공격 표적이 된다.
 */
export function KeyForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signInWithKey, {});

  return (
    <section className={styles.key}>
      <h2 className={styles.keyTitle}>편집실 열쇠</h2>
      <p className={styles.keyBody}>
        메일을 기다리지 않고 바로 들어갑니다. 초대가 끝나면 없앨 임시 통로입니다.
      </p>

      <form action={formAction} className={styles.keyForm}>
        <input type="hidden" name="next" value={next} />

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="key">
            열쇠
          </label>
          <input
            id="key"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            required
          />
        </div>

        <Submit>들어가기</Submit>
      </form>
    </section>
  );
}
