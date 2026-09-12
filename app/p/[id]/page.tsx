import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown';
import { categoryLabel } from '@/lib/categories';
import { authorPath, formatDateFull } from '@/lib/format';
import { getPublishedPost } from '@/lib/posts';
import { RATIO_CSS } from '@/lib/types';
import styles from './page.module.css';

// ISR + 발행 시 온디맨드 무효화(기획안 §2.3).
export const revalidate = 60;

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  // /p/12abc 가 12 로 해석되면 같은 글에 주소가 무한히 생긴다.
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const id = parseId((await params).id);
  if (id === null) return {};

  const post = await getPublishedPost(id);
  if (!post) return {};

  return {
    title: post.title,
    description: post.deck,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.deck,
      publishedTime: post.published_at ?? undefined,
      images: post.thumbnail_url ? [post.thumbnail_url] : undefined,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const post = await getPublishedPost(id);
  if (!post) notFound();

  const thumb = post.thumbnail_url;
  const hasThumb = thumb !== null && thumb !== '';
  const ratio = RATIO_CSS[post.thumbnail_ratio ?? '3:2'];

  return (
    <div className="page">
      <article className={styles.article}>
        <header className={styles.header}>
          <p className="kicker">
            <Link href={`/category/${post.category}`}>{categoryLabel(post.category)}</Link>
          </p>

          <h1 className={styles.title}>{post.title}</h1>
          <p className={styles.deck}>{post.deck}</p>

          <div className={styles.byline}>
            <span className={`avatar ${styles.avatar}`} aria-hidden="true" />
            {post.author ? (
              <Link href={authorPath(post.author.handle)} className={styles.author}>
                {post.author.display_name}
              </Link>
            ) : (
              <span className={styles.author} />
            )}
            <time className={styles.date} dateTime={post.published_at ?? undefined}>
              {formatDateFull(post.published_at)}
            </time>
          </div>
        </header>

        {hasThumb && (
          <figure className={`plate ${styles.figure}`} style={{ aspectRatio: ratio }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="plateImage" fetchPriority="high" />
          </figure>
        )}

        <div className={styles.body}>
          <Markdown>{post.body}</Markdown>
        </div>

        <footer className={styles.footer}>
          {/* 좋아요·댓글은 M3 / M3-1. 캐시된 페이지에 실시간 값을 섞지 않기 위해
              클라이언트 컴포넌트로 따로 붙인다(기획안 §2.3). */}
          <Link href={`/category/${post.category}`} className={styles.more}>
            {categoryLabel(post.category)} 더 보기
          </Link>
        </footer>
      </article>
    </div>
  );
}
