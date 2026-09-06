'use client';

import { useActionState } from 'react';
import { completeProfile, type AuthState } from '@/app/auth/actions';
import { Submit } from './LoginForm';
import styles from './auth.module.css';

/** 가입 도중 핸들이 겹쳤거나, 메타데이터 없이 계정만 생긴 경우 마지막 한 단계. */
export function CompleteForm({ handleTaken }: { handleTaken: boolean }) {
  const [state, formAction] = useActionState<AuthState, FormData>(completeProfile, {});

  return (
    <>
      <p className="kicker">ONE MORE STEP</p>
      <h1 className={styles.title}>이름을 정해 주세요</h1>
      <p className={styles.lede}>계정은 만들어졌습니다. 표시할 이름과 핸들만 정하면 끝입니다.</p>

      <form action={formAction} className={styles.form}>
        {handleTaken && !state.error && (
          <p className={styles.error} role="alert">
            메일을 확인하시는 사이에 그 핸들을 다른 분이 가져갔습니다. 다시 골라 주세요.
          </p>
        )}
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="display_name">
            이름
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
            핸들 <span className={styles.hint}>영소문자·숫자·밑줄 3~20자.</span>
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

        <Submit>시작하기</Submit>
      </form>
    </>
  );
}
