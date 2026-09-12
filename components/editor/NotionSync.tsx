'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { runNotionSync, type SyncState } from '@/app/editor/actions';
import styles from './editor.module.css';

const ACTION_LABEL: Record<string, string> = {
  created: '새로 들어옴',
  updated: '갱신',
  unchanged: '그대로',
  skipped: '건너뜀',
  failed: '실패',
};

/**
 * 노션 동기화 버튼 (M2-4).
 *
 * 자동 실행은 Vercel Cron 이 하고, 이건 "지금 당장" 을 위한 것이다.
 * 방금 노션에서 상태를 '발행' 으로 바꾸고 10분을 기다리고 싶지 않을 때 쓴다.
 */
export function NotionSync({ enabled }: { enabled: boolean }) {
  const [state, formAction] = useActionState<SyncState, FormData>(runNotionSync, {});

  if (!enabled) {
    return (
      <p className={styles.hintBlock}>
        노션 동기화가 꺼져 있습니다. <code>NOTION_TOKEN</code> 과{' '}
        <code>NOTION_DATABASE_ID</code> 를 설정하면 여기에 버튼이 생깁니다.
        설정법은 README 의 &ldquo;노션에서 쓰기&rdquo;를 보세요.
      </p>
    );
  }

  return (
    <div className={styles.syncWrap}>
      <form action={formAction}>
        <Submit />
      </form>

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

      {state.outcomes && state.outcomes.length > 0 && (
        <ul className={styles.syncList}>
          {state.outcomes.map((o) => (
            <li key={o.notionPageId} className={styles.syncRow}>
              <span
                className={
                  o.action === 'failed'
                    ? styles.syncBadgeWarn
                    : o.action === 'created' || o.action === 'updated'
                      ? styles.syncBadgeOn
                      : styles.syncBadge
                }
              >
                {ACTION_LABEL[o.action] ?? o.action}
              </span>
              <span className={styles.syncTitle}>
                {o.postId !== undefined && o.status === 'published' ? (
                  <Link href={`/p/${o.postId}`}>{o.title}</Link>
                ) : (
                  o.title
                )}
              </span>
              <span className={styles.syncNote}>{o.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      {pending ? '노션을 읽는 중…' : '지금 동기화'}
    </button>
  );
}
