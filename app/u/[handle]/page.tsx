import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { HANDLE_PATTERN } from '@/lib/auth';
import { getProfileByHandle, listPublishedByAuthor } from '@/lib/posts';
import styles from './page.module.css';

// 홈·카테고리와 같은 ISR 60초. 글이 발행되면 write 액션이 이 경로를 직접 무효화한다.
export const revalidate = 60;

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  if (!HANDLE_PATTERN.test(handle)) return {};

  const profile = await getProfileByHandle(handle);
  if (!profile) return {};

  return {
    title: profile.display_name,
    description: profile.bio ?? `${profile.display_name}의 글`,
  };
}

export default async function AuthorPage({ params }: Params) {
  const { handle } = await params;

  // 핸들 형식이 아니면 DB 에 물어볼 것도 없다. /u/%EA%B0%80 같은 요청으로
  // 쿼리를 유발하지 않는다.
  if (!HANDLE_PATTERN.test(handle)) notFound();

  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const posts = await listPublishedByAuthor(profile.id);

  return (
    <div className="page">
      <header className={styles.head}>
        <span className={`avatar ${styles.avatar}`} aria-hidden="true" />
        <div className={styles.identity}>
          <h1 className={styles.name}>{profile.display_name}</h1>
          <p className={styles.handle}>@{profile.handle}</p>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{posts.length}</span>
          <span className={styles.statLabel}>발행</span>
        </div>
      </header>

      {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

      <div className="rule-thick" />

      {posts.length === 0 ? (
        <section className={styles.empty}>
          <h2 className={styles.emptyTitle}>아직 발행한 글이 없습니다</h2>
          <p className={styles.emptyBody}>
            {profile.display_name}의 첫 글을 기다리고 있습니다.
          </p>
        </section>
      ) : (
        <ul className={styles.grid}>
          {posts.map((post, i) => (
            <li key={post.id}>
              {/* 필자 페이지에서는 필자명을 다시 링크로 만들지 않는다.
                  이미 그 사람의 페이지다(PostCard 의 linkAuthor). */}
              <PostCard post={post} index={i + 1} linkAuthor={false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
