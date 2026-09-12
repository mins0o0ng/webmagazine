'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { addComment, removeComment } from '@/app/p/[id]/actions';
import { authorPath, formatDateFull } from '@/lib/format';
import { browserClient } from '@/lib/supabaseBrowser';
import styles from './engage.module.css';

interface Row {
  id: number;
  body: string;
  created_at: string;
  author_id: string;
  author: { handle: string; display_name: string } | null;
}

interface Me {
  id: string;
  isAdmin: boolean;
}

const LIMIT = 2000;

/**
 * 댓글 (M3-1).
 *
 * 좋아요와 같은 이유로 브라우저에서 읽는다 — 글 상세는 ISR 이고, 서버에서
 * 댓글을 렌더하면 댓글 하나에 지면 캐시를 비워야 한다(§2.3).
 *
 * 목록 자체는 공개 데이터지만 SEO 대상이 아니다. 검색엔진이 색인해야 하는 것은
 * 본문이고, 그건 그대로 서버가 렌더한다.
 */
export function Comments({ postId, initialCount }: { postId: number; initialCount: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const supabase = browserClient();

    // comments_read_visible 상 지워진 댓글은 anon 에게 안 보인다.
    const { data, error: readError } = await supabase
      .from('comments')
      .select('id, body, created_at, author_id, author:profiles!comments_author_id_fkey (handle, display_name)')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (readError) {
      setError('댓글을 불러오지 못했습니다.');
      setRows([]);
      return;
    }
    setRows((data ?? []) as unknown as Row[]);
  }, [postId]);

  useEffect(() => {
    let alive = true;
    const supabase = browserClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, is_admin')
          .eq('id', user.id)
          .maybeSingle();
        if (alive) setMe(profile ? { id: profile.id, isAdmin: Boolean(profile.is_admin) } : null);
      } else {
        setMe(null);
      }

      await load();
    })();

    return () => {
      alive = false;
    };
  }, [load]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;

    setError(null);
    start(async () => {
      const result = await addComment(postId, body);
      if (result.error) {
        setError(result.error);
        return;
      }
      setText('');
      await load();
    });
  }

  function remove(id: number) {
    setError(null);
    start(async () => {
      const result = await removeComment(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      await load();
    });
  }

  const count = rows?.length ?? initialCount;
  const left = LIMIT - text.length;

  return (
    <section className={styles.comments} aria-labelledby="comments-heading">
      <div className={styles.commentsHead}>
        <h2 id="comments-heading" className={styles.commentsTitle}>
          댓글
        </h2>
        <span className={styles.commentsCount}>{count}</span>
      </div>
      <div className="rule-thin" />

      {/* 목록 ---------------------------------------------------------- */}

      {rows === null ? (
        // 로딩 중에 "댓글이 없습니다" 를 먼저 보여주면 있는데 없다고 말하는 셈이다.
        <p className={styles.commentsLoading}>불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className={styles.commentsEmpty}>첫 댓글을 남겨 주세요.</p>
      ) : (
        <ul className={styles.commentList}>
          {rows.map((row) => (
            <li key={row.id} className={styles.comment}>
              <div className={styles.commentMeta}>
                <span className={`avatar ${styles.commentAvatar}`} aria-hidden="true" />
                {row.author ? (
                  <Link href={authorPath(row.author.handle)} className={styles.commentAuthor}>
                    {row.author.display_name}
                  </Link>
                ) : (
                  <span className={styles.commentAuthor}>알 수 없음</span>
                )}
                <time className={styles.commentDate} dateTime={row.created_at}>
                  {formatDateFull(row.created_at)}
                </time>

                {me && (me.id === row.author_id || me.isAdmin) && (
                  <button
                    type="button"
                    className={styles.commentDelete}
                    onClick={() => remove(row.id)}
                    disabled={pending}
                  >
                    지우기
                  </button>
                )}
              </div>
              {/* 원시 HTML 을 렌더하지 않는다. 본문과 달리 댓글은 마크다운도 쓰지 않는다 —
                  남의 글에 링크와 이미지를 심을 수 있게 열어 줄 이유가 없다. */}
              <p className={styles.commentBody}>{row.body}</p>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className={styles.commentError} role="alert">
          {error}
        </p>
      )}

      {/* 입력 ---------------------------------------------------------- */}

      {me === undefined ? null : me === null ? (
        <p className={styles.commentsSignedOut}>
          <Link href="/login" className={styles.commentsLoginLink}>
            로그인
          </Link>
          하면 댓글을 남길 수 있습니다.
        </p>
      ) : (
        <form onSubmit={submit} className={styles.commentForm}>
          <label className="visually-hidden" htmlFor="comment-body">
            댓글
          </label>
          <textarea
            id="comment-body"
            className={styles.commentInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={LIMIT}
            rows={3}
            placeholder="읽고 남은 생각을 적어 주세요."
          />
          <div className={styles.commentActions}>
            <span className={left < 100 ? styles.commentLeftWarn : styles.commentLeft}>
              {left}
            </span>
            <button
              type="submit"
              className={styles.commentSubmit}
              disabled={pending || text.trim() === ''}
            >
              남기기
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
