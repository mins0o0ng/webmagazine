import Link from 'next/link';
import { categoryLabel } from '@/lib/categories';
import { authorPath, formatCount, formatDateShort, postPath } from '@/lib/format';
import { RATIO_CSS, type PostSummary, type ThumbRatio } from '@/lib/types';
import styles from './PostCard.module.css';

interface Props {
  post: PostSummary;
  /** 디자인의 카드 순번(01, 02 …). 넘기지 않으면 순번을 그리지 않는다. */
  index?: number;
  /** 썸네일 비율이 저장돼 있지 않을 때 쓸 기본값. */
  fallbackRatio?: ThumbRatio;
  /** 필자명을 /u/[handle] 로 걸지 여부. 필자 페이지 안에서는 끈다 (M2-1). */
  linkAuthor?: boolean;
}

export function PostCard({ post, index, fallbackRatio = '3:4', linkAuthor = true }: Props) {
  const thumb = post.thumbnail_url;
  const hasThumb = thumb !== null && thumb !== '';
  const ratio = post.thumbnail_ratio ?? fallbackRatio;

  return (
    <article className={styles.card}>
      {index !== undefined && (
        <div className={styles.num} aria-hidden="true">
          {String(index).padStart(2, '0')}
        </div>
      )}

      {hasThumb && (
        <div
          className={`plate ${styles.plate}`}
          style={{ aspectRatio: RATIO_CSS[ratio] }}
        >
          {/* next/image 대신 img: Supabase Storage 호스트가 아직 확정되지 않았고,
              외부 URL 을 손으로 넣는 M1 단계에서는 도메인 화이트리스트가 계속 깨진다.
              이미지 업로드가 붙는 시점(§8 미결정)에 next/image 로 교체한다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="plateImage" loading="lazy" />
        </div>
      )}

      <div className={`kicker ${styles.kickerRow}`}>{categoryLabel(post.category)}</div>

      <h3 className={`${styles.title} ${hasThumb ? '' : styles.titleLarge}`}>
        <Link href={postPath(post.id)} className={styles.titleLink}>
          {post.title}
        </Link>
      </h3>

      <p className={styles.deck}>{post.deck}</p>

      <div className={`${styles.meta} ${styles.metaPush}`}>
        <span className={`avatar ${styles.avatar}`} aria-hidden="true" />
        {linkAuthor && post.author ? (
          // .titleLink::after 가 카드 전체를 덮으므로 이 링크는 그 위로 올려야
          // 클릭이 닿는다(.authorLink 의 z-index).
          <Link
            href={authorPath(post.author.handle)}
            className={`${styles.author} ${styles.authorLink}`}
          >
            {post.author.display_name}
          </Link>
        ) : (
          <span className={styles.author}>{post.author?.display_name}</span>
        )}
        <time className={styles.date} dateTime={post.published_at ?? undefined}>
          {formatDateShort(post.published_at)}
        </time>
        <span className={styles.count}>{formatCount(post.like_count)}</span>
        <span className={styles.heart} aria-hidden="true" />
        <span className="visually-hidden">좋아요 {post.like_count}</span>
      </div>
    </article>
  );
}
