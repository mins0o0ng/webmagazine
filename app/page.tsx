import Link from 'next/link';
import { PostCard } from '@/components/PostCard';
import { categoryLabel } from '@/lib/categories';
import {
  formatCount,
  formatDateFull,
  getEditorsPick,
  listMonthlyAuthors,
  listPublished,
  postPath,
  type MonthlyAuthor,
} from '@/lib/posts';
import { RATIO_CSS, type PostSummary } from '@/lib/types';
import styles from './page.module.css';

// ISR 60초 (기획안 §2.3 — 글이 자주 안 바뀐다)
export const revalidate = 60;

export default async function HomePage() {
  const pick = await getEditorsPick();

  // 에디터 픽은 아래 검정 띠로 따로 나가므로 피드에서 뺀다.
  const [feed, people] = await Promise.all([
    listPublished({ limit: 5, excludeId: pick?.id }),
    listMonthlyAuthors(),
  ]);

  if (feed.length === 0 && !pick) {
    return (
      <div className="page">
        <section className={styles.empty}>
          <h1 className={styles.emptyTitle}>아직 아무도 쓰지 않았습니다</h1>
          <p className={styles.emptyBody}>
            여기는 읽고 쓰는 사람들의 자리입니다. 첫 자리는 비어 있습니다.
          </p>
          <Link href="/write" className={styles.emptyAction}>
            첫 글 쓰기
          </Link>
        </section>
      </div>
    );
  }

  const [lead, ...cards] = feed;

  return (
    <div className="page">
      {lead && <LeadStory post={lead} />}

      {cards.length > 0 && (
        <>
          <div className={`rule-thin ${styles.gridRule}`} />
          <ul className={styles.grid}>
            {cards.map((post, i) => (
              <li key={post.id}>
                <PostCard post={post} index={i + 1} />
              </li>
            ))}
          </ul>
        </>
      )}

      {pick && <EditorsPick post={pick} />}

      {people.length > 0 && <MonthlyPeople people={people} />}
    </div>
  );
}

/* -------------------------------------------------------------------- */

function LeadStory({ post }: { post: PostSummary }) {
  const thumb = post.thumbnail_url;
  const hasThumb = thumb !== null && thumb !== '';
  const ratio = RATIO_CSS[post.thumbnail_ratio ?? '3:2'];

  return (
    <article className={`${styles.lead} ${hasThumb ? '' : styles.leadFull}`}>
      {hasThumb && (
        <div className={`plate ${styles.leadPlate}`} style={{ aspectRatio: ratio }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="plateImage" fetchPriority="high" />
        </div>
      )}

      <div className={styles.leadBody}>
        <p className="kicker">{categoryLabel(post.category)}</p>

        <h1 className={styles.leadTitle}>
          <Link href={postPath(post.id)}>{post.title}</Link>
        </h1>

        <p className={styles.leadDeck}>{post.deck}</p>

        <div className={`rule-thin ${styles.leadRule}`} />

        <div className={styles.leadMeta}>
          <span className={`avatar ${styles.leadAvatar}`} aria-hidden="true" />
          <span className={styles.leadAuthor}>{post.author?.display_name}</span>
          <time className={styles.leadDate} dateTime={post.published_at ?? undefined}>
            {formatDateFull(post.published_at)}
          </time>
          <div className={styles.leadLikes}>
            <span>{formatCount(post.like_count)}</span>
            <span className="visually-hidden">좋아요</span>
            {/* 북마크·하트는 M3 에서 기능이 붙는다. 지금은 디자인대로 놓인 표시다. */}
            <span className={styles.leadBookmark} aria-hidden="true" />
            <span className={styles.leadHeart} aria-hidden="true" />
          </div>
        </div>
      </div>
    </article>
  );
}

function EditorsPick({ post }: { post: PostSummary }) {
  const thumb = post.thumbnail_url;
  const hasThumb = thumb !== null && thumb !== '';

  return (
    <article className={styles.band}>
      <div>
        <p className="kicker">{categoryLabel(post.category)}</p>
        <h2 className={styles.bandTitle}>
          <Link href={postPath(post.id)} className={styles.bandTitleLink}>
            {post.title}
          </Link>
        </h2>
        <p className={styles.bandDeck}>{post.deck}</p>
        <div className={styles.bandMeta}>
          <span className={`avatar ${styles.bandAvatar}`} aria-hidden="true" />
          <span className={styles.bandAuthor}>{post.author?.display_name}</span>
          <time className={styles.bandDate} dateTime={post.published_at ?? undefined}>
            {formatDateFull(post.published_at)}
          </time>
        </div>
      </div>

      {/* 띠 안의 사진 자리는 3:1 로 넓게 자른다. 저장된 비율과 무관한 띠 고유의 판형이다. */}
      {hasThumb && (
        <div className="plate" style={{ aspectRatio: '3 / 1' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="plateImage" loading="lazy" />
        </div>
      )}
    </article>
  );
}

function MonthlyPeople({ people }: { people: MonthlyAuthor[] }) {
  return (
    <section>
      <div className={`rule-thin ${styles.peopleRule}`} />

      <div className={styles.peopleHead}>
        <h2 className={styles.peopleTitle}>이번 달에 쓴 사람들</h2>
        <Link href="/about" className={styles.peopleMore}>
          전체 보기
        </Link>
      </div>

      <ul className={styles.people}>
        {people.map((person) => (
          <li key={person.handle} className={styles.person}>
            <span className={`avatar ${styles.personAvatar}`} aria-hidden="true" />
            <div>
              {/* 필자 페이지 /u/[handle] 은 M2-1 이다. 그전까지 이름은 링크가 아니다. */}
              <div className={styles.personName}>{person.display_name}</div>
              <div className={styles.personCount}>글 {person.post_count}</div>
            </div>
          </li>
        ))}

        <li className={styles.join}>
          <Link href="/write" className={styles.joinMark} aria-hidden="true">
            +
          </Link>
          <Link href="/write" className={styles.joinLabel}>
            여기 서기
          </Link>
        </li>
      </ul>
    </section>
  );
}
