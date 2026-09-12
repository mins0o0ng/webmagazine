import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MyPostRow } from '@/components/MyPostRow';
import { listMyPosts } from '@/lib/authorPosts';
import { canWrite, currentProfile } from '@/lib/auth';
import { authorPath } from '@/lib/format';
import styles from './page.module.css';

// 본인 것만 보이는 화면이므로 캐시하지 않는다(§2.3).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '내 글', robots: { index: false } };

export default async function MePage() {
  // 비로그인은 미들웨어가 /login 으로 돌린다(PROTECTED).
  const profile = await currentProfile();
  if (!profile) redirect('/auth/complete');

  const posts = await listMyPosts(profile.id);
  const drafts = posts.filter((p) => p.status !== 'published');
  const published = posts.filter((p) => p.status === 'published');
  const mayWrite = canWrite(profile);

  return (
    <div className={`page ${styles.wrap}`}>
      <header className={styles.head}>
        <div>
          <p className="kicker">내 자리</p>
          <h1 className={styles.name}>{profile.display_name}</h1>
          <p className={styles.handle}>
            <Link href={authorPath(profile.handle)}>@{profile.handle}</Link>
          </p>
        </div>

        <div className={styles.headActions}>
          {profile.is_admin && (
            <Link href="/editor" className={styles.secondary}>
              편집실
            </Link>
          )}
          {mayWrite && (
            <>
              {/* 노션 등에 써둔 원고를 붙여넣어 초안으로 들이는 경로(M2-3).
                  이게 supabase/seed_posts.sql 같은 파일을 대신한다. */}
              <Link href="/write/import" className={styles.secondary}>
                가져오기
              </Link>
              <Link href="/write" className={styles.primary}>
                새 글
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="rule-thick" />

      {!mayWrite && (
        <p className={styles.notice}>
          지금은 읽기 계정입니다. 편집실이 기고 권한을 켜면 여기에 글쓰기가 열립니다.
        </p>
      )}

      <Section
        title="쓰는 중"
        count={drafts.length}
        empty="임시저장한 글이 없습니다."
        posts={drafts}
      />

      <Section
        title="발행한 글"
        count={published.length}
        empty="아직 발행한 글이 없습니다."
        posts={published}
      />
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  posts,
}: {
  title: string;
  count: number;
  empty: string;
  posts: Awaited<ReturnType<typeof listMyPosts>>;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionCount}>{count}</span>
      </div>
      <div className="rule-thin" />

      {posts.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <MyPostRow post={post} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
