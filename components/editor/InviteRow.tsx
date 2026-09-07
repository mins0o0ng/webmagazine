'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { revokeInvite, type EditorState } from '@/app/editor/actions';
import { formatDateFull } from '@/lib/format';
import type { ContributorInvite } from '@/lib/types';
import styles from './editor.module.css';

/** 초대장 한 줄 (M2-1). 수락 전이면 취소할 수 있다. */
export function InviteRow({ invite }: { invite: ContributorInvite }) {
  const [state, formAction] = useActionState<EditorState, FormData>(revokeInvite, {});
  const accepted = invite.accepted_at !== null;

  return (
    <div className={styles.invite}>
      <div className={styles.inviteMain}>
        <div className={styles.inviteEmail}>{invite.email}</div>
        <div className={styles.inviteMeta}>
          {accepted
            ? `수락 ${formatDateFull(invite.accepted_at)}`
            : `초대 ${formatDateFull(invite.created_at)}`}
          {invite.note && ` · ${invite.note}`}
        </div>
        {state.error && (
          <div className={styles.toggleError} role="alert">
            {state.error}
          </div>
        )}
      </div>

      {!accepted && (
        <form action={formAction}>
          <input type="hidden" name="email" value={invite.email} />
          <Cancel />
        </form>
      )}
    </div>
  );
}

function Cancel() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.toggleOff} disabled={pending}>
      초대 취소
    </button>
  );
}
