import Link from 'next/link';
import { PostCard } from '@/components/PostCard';
import { categoryLabel } from '@/lib/categories';
import { formatDate, listPublished, postPath } from '@/lib/posts';
import type { PostSummary } from '@/lib/types';
import styles from './page.module.css';

// ISR 60초 (§2.3 — 글이 자주 안 바뀐다)
export const revalidate = 60;

export default async function HomePage() {
  const posts = await listPublished({ limit: 21 });

  if (posts.length === 0) {
    return (
      <div className="page">
        <section className={styles.empty}>
          <h1 className={styles.emptyTitle}>아직 첫 글이 없습니다</h1>
          <p className={styles.emptyBody}>
            여기는 곧 채워집니다. 먼저 쓰실 분을 기다리는 중입니다.
          </p>
          <Link href="/write" className={styles.emptyAction}>
            첫 글 쓰기
          </Link>
        </section>
      </div>
    );
  }

  const [lead, ...rest] = posts;

  return (
    <div className="page">
      <LeadStory post={lead} />

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>최신 글</h2>
        <Link href="/category/essay" className={styles.more}>
          전체 보기
        </Link>
      </div>

      <ul className={styles.grid}>
        {rest.map((post, i) => (
          <li key={post.id}>
            {/* 비율을 돌려가며 배치해야 매거진처럼 보인다(§3.2).
                썸네일이 없는 카드에도 적용되어 활자 블록의 높이가 균일해지지 않는다. */}
            <PostCard post={post} fallbackRatio={i % 3 === 1 ? '3:4' : '3:2'} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeadStory({ post }: { post: PostSummary }) {
  const thumb = post.thumbnail_url;
  const hasThumb = thumb !== null && thumb !== '';

  return (
    <article className={styles.lead}>
      <div>
        <p className="eyebrow">{categoryLabel(post.category)}</p>
        <h1 className={styles.leadTitle}>
          <Link href={postPath(post.id)}>{post.title}</Link>
        </h1>
        {/* 썸네일이 없으면 부제가 오른쪽 활자 블록으로 올라간다. 여기서 또 쓰면 중복된다. */}
        {hasThumb && <p className={styles.leadDeck}>{post.deck}</p>}
        <p className={styles.leadMeta}>
          {post.author?.display_name} · {formatDate(post.published_at)}
        </p>
      </div>

      {hasThumb ? (
        <figure className={styles.leadFigure} style={{ aspectRatio: '3 / 2' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            className={styles.leadImage}
            fetchPriority="high"
          />
        </figure>
      ) : (
        <div className={styles.leadTypeblock} style={{ aspectRatio: '3 / 2' }}>
          {post.deck}
        </div>
      )}
    </article>
  );
}
