import Link from 'next/link';
import { categoryLabel } from '@/lib/categories';
import { formatDate, postPath } from '@/lib/posts';
import { RATIO_CSS, type PostSummary } from '@/lib/types';
import styles from './PostCard.module.css';

interface Props {
  post: PostSummary;
  /** 썸네일 비율이 지정되지 않았을 때 카드가 쓸 기본 비율. */
  fallbackRatio?: keyof typeof RATIO_CSS;
}

export function PostCard({ post, fallbackRatio = '3:2' }: Props) {
  const ratio = RATIO_CSS[post.thumbnail_ratio ?? fallbackRatio];

  return (
    <article className={styles.card}>
      {post.thumbnail_url ? (
        <div className={styles.thumb} style={{ aspectRatio: ratio }}>
          {/* next/image 대신 img: Supabase Storage 호스트가 아직 확정되지 않았고,
              외부 URL 을 손으로 넣는 M1 단계에서는 도메인 화이트리스트가 계속 깨진다.
              이미지 업로드가 붙는 시점(§8 미결정)에 next/image 로 교체한다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.thumbnail_url}
            alt=""
            className={styles.thumbImage}
            loading="lazy"
          />
        </div>
      ) : (
        <div className={styles.typeblock} style={{ aspectRatio: ratio }}>
          <p className={styles.typeblockText}>{post.deck}</p>
        </div>
      )}

      <div className={styles.meta}>
        <span className={styles.category}>{categoryLabel(post.category)}</span>
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <time className={styles.date} dateTime={post.published_at ?? undefined}>
          {formatDate(post.published_at)}
        </time>
      </div>

      <h3 className={styles.title}>
        {/* 이 링크가 ::after 로 카드 전체를 덮는다. 카드 전체를 <Link> 로 감싸는 것보다
            나은 이유: M2-1 에서 필자명이 별도 링크가 될 때 링크 중첩이 생기지 않는다. */}
        <Link href={postPath(post.id)} className={styles.titleLink}>
          {post.title}
        </Link>
      </h3>

      {/* 썸네일이 없는 카드는 부제를 이미 활자 블록으로 크게 썼다.
          여기서 또 반복하면 같은 문장이 카드에 두 번 나온다. */}
      {post.thumbnail_url && <p className={styles.deck}>{post.deck}</p>}

      <p className={styles.author}>{post.author?.display_name}</p>
    </article>
  );
}
