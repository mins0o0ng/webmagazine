import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { CATEGORIES, categoryLabel, isCategory } from '@/lib/categories';
import { listPublished } from '@/lib/posts';
import styles from './page.module.css';

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategory(slug)) return {};
  return { title: categoryLabel(slug) };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  if (!isCategory(slug)) notFound();

  const posts = await listPublished({ category: slug, limit: 30 });

  return (
    <div className="page">
      <div className={styles.head}>
        <h1 className={styles.title}>{categoryLabel(slug)}</h1>
        {posts.length > 0 && <span className={styles.count}>글 {posts.length}</span>}
      </div>
      <div className="rule-thick" />

      {posts.length === 0 ? (
        <section className={styles.empty}>
          <h2 className={styles.emptyTitle}>이 칸은 아직 비어 있습니다</h2>
          <p className={styles.emptyBody}>
            {categoryLabel(slug)}의 첫 글을 기다리고 있습니다.
          </p>
        </section>
      ) : (
        <ul className={styles.grid}>
          {posts.map((post, i) => (
            <li key={post.id}>
              <PostCard post={post} index={i + 1} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
