'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { inviteContributor, type EditorState } from '@/app/editor/actions';
import styles from './editor.module.css';

/**
 * 주소로 미리 초대해 두는 폼 (M2-1).
 *
 * 메일을 보내지 않는다는 점이 중요하다. 여기서 하는 일은 "이 주소로 가입하면
 * 기고 권한을 준다" 를 명단에 적어두는 것뿐이고, 초대 사실을 알리는 건 편집장이
 * 직접 한다. 메일 발송을 붙이면 Supabase 의 매직링크와 별개인 발송 경로가
 * 하나 더 생기고, 그때부터 스팸 신고와 도메인 평판을 관리해야 한다.
 */
export function InviteForm() {
  const [state, formAction] = useActionState<EditorState, FormData>(inviteContributor, {});

  return (
    <form action={formAction} className={styles.inviteForm}>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className={styles.ok} role="status">
          {state.ok}
        </p>
      )}

      <div className={styles.inviteFields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="invite-email">
            이메일
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            className={styles.input}
            placeholder="name@example.com"
            autoComplete="off"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="invite-note">
            메모 <span className={styles.hint}>누구인지, 왜 초대했는지</span>
          </label>
          <input
            id="invite-note"
            name="note"
            className={styles.input}
            maxLength={200}
            autoComplete="off"
          />
        </div>

        <Submit />
      </div>

      <p className={styles.hintBlock}>
        메일은 나가지 않습니다. 명단에 적어둘 뿐이고, 그 주소로 가입하는 순간
        기고 권한이 켜집니다. 초대했다는 사실은 직접 알려주세요.
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      초대
    </button>
  );
}
