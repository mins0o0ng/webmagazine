'use client';

import { useEffect, useState, useTransition } from 'react';
import { toggleLike } from '@/app/p/[id]/actions';
import { formatCount } from '@/lib/format';
import { browserClient } from '@/lib/supabaseBrowser';
import styles from './engage.module.css';

/**
 * 좋아요 (M3).
 *
 * 서버에서 렌더하지 않는다. 글 상세는 ISR 이라 "이 사람이 눌렀나" 를 서버에서
 * 읽는 순간 페이지가 동적 렌더링으로 바뀌고 캐시가 통째로 사라진다(§2.3).
 * 캐시된 지면에 개인 상태를 섞지 않는다는 원칙은 마스트헤드의 로그인 표시와 같다.
 *
 * 초기 개수는 서버가 렌더한 값(캐시된 값일 수 있다)을 받아 먼저 보여주고,
 * 마운트 뒤 지금 값으로 덮는다. 0 부터 세는 깜박임을 만들지 않기 위해서다.
 */
export function LikeButton({ postId, initialCount }: { postId: number; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const supabase = browserClient();
    let alive = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      setSignedIn(user !== null);

      // 개수는 anon 으로도 읽힌다(발행글). 캐시된 초기값을 지금 값으로 덮는다.
      const { data: post } = await supabase
        .from('posts')
        .select('like_count')
        .eq('id', postId)
        .maybeSingle();
      if (alive && post) setCount(post.like_count as number);

      if (!user) {
        if (alive) setLiked(false);
        return;
      }

      // likes_read_self 상 본인 행만 보인다(마이그레이션 6).
      const { data: mine } = await supabase
        .from('likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('actor_key', user.id)
        .maybeSingle();
      if (alive) setLiked(mine !== null);
    })();

    return () => {
      alive = false;
    };
  }, [postId]);

  function press() {
    if (signedIn === false) {
      setError('로그인하면 누를 수 있습니다.');
      return;
    }
    if (liked === null) return; // 아직 상태를 모른다

    // 낙관적 업데이트. 서버 왕복을 기다리면 누른 느낌이 나지 않는다.
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(c + (next ? 1 : -1), 0));
    setError(null);

    start(async () => {
      const result = await toggleLike(postId);
      if (result.error) {
        // 되돌린다. 낙관적 업데이트는 실패했을 때 되돌리지 않으면 거짓말이 된다.
        setLiked(!next);
        setCount((c) => Math.max(c + (next ? -1 : 1), 0));
        setError(result.error);
        return;
      }
      if (result.liked !== undefined) setLiked(result.liked);
      if (result.count !== undefined) setCount(result.count);
    });
  }

  return (
    <div className={styles.likeWrap}>
      <button
        type="button"
        onClick={press}
        disabled={pending || liked === null}
        aria-pressed={liked ?? false}
        className={`${styles.like} ${liked ? styles.likeOn : ''}`}
      >
        <span className={styles.heart} aria-hidden="true" />
        <span className={styles.likeCount}>{formatCount(count)}</span>
        <span className="visually-hidden">
          좋아요 {count}
          {liked ? ' — 누름' : ''}
        </span>
      </button>

      {error && (
        <span className={styles.likeError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
