'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { setContributor, type EditorState } from '@/app/editor/actions';
import styles from './editor.module.css';

interface Props {
  id: string;
  name: string;
  canWrite: boolean;
  isAdmin: boolean;
  /** 편집장 본인 줄. 자기 권한을 자기가 끄는 사고를 막는다. */
  isSelf: boolean;
}

/**
 * 명단 한 줄의 기고 권한 스위치 (M2-1).
 *
 * 체크박스가 아니라 버튼이다. 체크박스는 눌린 순간 상태가 바뀐 것처럼 보이는데,
 * 실제 반영은 서버 액션이 끝나야 한다. 그 사이의 거짓 상태를 만들지 않는다.
 */
export function ContributorToggle({ id, name, canWrite, isAdmin, isSelf }: Props) {
  const [state, formAction] = useActionState<EditorState, FormData>(setContributor, {});

  if (isAdmin) {
    return (
      <span className={styles.toggleFixed} title="편집장은 초대 없이 씁니다">
        기고 가능
      </span>
    );
  }

  return (
    <div className={styles.toggleWrap}>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        {/* 서버는 'on' 만 부여로 읽는다. 지금 켜져 있으면 끄는 요청이 된다. */}
        <input type="hidden" name="grant" value={canWrite ? 'off' : 'on'} />
        <ToggleButton canWrite={canWrite} name={name} disabled={isSelf} />
      </form>

      {state.error && (
        <span className={styles.toggleError} role="alert">
          {state.error}
        </span>
      )}
    </div>
  );
}

function ToggleButton({
  canWrite,
  name,
  disabled,
}: {
  canWrite: boolean;
  name: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={canWrite ? styles.toggleOn : styles.toggleOff}
      disabled={disabled || pending}
    >
      {canWrite ? '권한 거두기' : '기고 권한 주기'}
      <span className="visually-hidden"> — {name}</span>
    </button>
  );
}
