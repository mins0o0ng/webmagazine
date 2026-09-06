'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { unlock, type ActionState } from '@/app/write/actions';
import styles from './PostEditor.module.css';

export function PasswordGate() {
  const [state, formAction] = useActionState<ActionState, FormData>(unlock, {});

  return (
    <div className={`page ${styles.wrap}`}>
      <h1 className={styles.heading}>편집자 확인</h1>
      <form action={formAction} className={styles.form}>
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            관리자 비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            required
          />
        </div>
        <div className={styles.actions}>
          <Submit />
        </div>
      </form>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      들어가기
    </button>
  );
}
