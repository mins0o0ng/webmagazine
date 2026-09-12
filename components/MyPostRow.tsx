'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deletePost, type ActionState } from '@/app/write/actions';
import { categoryLabel } from '@/lib/categories';
import { formatDateFull, postPath } from '@/lib/format';
import type { AuthoredPost } from '@/lib/authorPosts';
import styles from './MyPostRow.module.css';

const STATUS_LABEL: Record<AuthoredPost['status'], string> = {
  draft: '임시저장',
  published: '발행됨',
  hidden: '숨김',
};

/**
 * /me 의 글 한 줄 (M2-1).
 *
 * 삭제가 클라이언트 컴포넌트를 필요로 하는 유일한 이유는 확인 단계다. 발행된 글이
 * 한 번의 오조작으로 사라지면 댓글과 좋아요까지 cascade 로 함께 사라진다.
 * window.confirm 을 쓰지 않은 것은 그게 디자인 밖의 브라우저 UI 이기 때문이다.
 */
export function MyPostRow({ post }: { post: AuthoredPost }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deletePost, {});
  const [confirming, setConfirming] = useState(false);

  const isPublished = post.status === 'published';
  const date = isPublished ? post.published_at : post.updated_at;
  // 노션이 원본인 글은 사이트에서 고칠 수 없다(M2-4). 다음 동기화가 덮어쓴다.
  const fromNotion = post.notion_page_id !== null;

  return (
    <article className={styles.row}>
      <div className={styles.main}>
        <div className={styles.tags}>
          <span className={`${styles.status} ${isPublished ? styles.statusOn : ''}`}>
            {STATUS_LABEL[post.status]}
          </span>
          <span className={styles.category}>{categoryLabel(post.category)}</span>
          {fromNotion && <span className={styles.source}>노션</span>}
        </div>

        <h3 className={styles.title}>
          {isPublished || fromNotion ? (
            <Link href={postPath(post.id)}>{post.title}</Link>
          ) : (
            <Link href={`/write/${post.id}`}>{post.title}</Link>
          )}
        </h3>

        <p className={styles.deck}>{post.deck}</p>

        <p className={styles.meta}>
          {isPublished ? '발행 ' : '수정 '}
          {formatDateFull(date)}
          {isPublished && ` · 좋아요 ${post.like_count} · 댓글 ${post.comment_count}`}
        </p>

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
      </div>

      <div className={styles.actions}>
        {fromNotion ? (
          // 삭제도 막는다. 지워도 다음 동기화가 다시 만들어 낸다.
          <span className={styles.locked}>노션에서 고치세요</span>
        ) : (
          <>
            <Link href={`/write/${post.id}`} className={styles.edit}>
              수정
            </Link>

            {confirming ? (
          <form action={formAction} className={styles.confirm}>
            <input type="hidden" name="id" value={post.id} />
            <DeleteButton published={isPublished} />
            <button
              type="button"
              className={styles.cancel}
              onClick={() => setConfirming(false)}
            >
              그만두기
            </button>
          </form>
            ) : (
              <button
                type="button"
                className={styles.delete}
                onClick={() => setConfirming(true)}
              >
                삭제
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function DeleteButton({ published }: { published: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.deleteConfirm} disabled={pending}>
      {published ? '발행글을 지웁니다' : '지웁니다'}
    </button>
  );
}
