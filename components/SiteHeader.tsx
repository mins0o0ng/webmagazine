import Link from 'next/link';
import { AuthNav } from '@/components/auth/AuthNav';
import { CATEGORIES } from '@/lib/categories';
import { SITE_NAME, SITE_PROVISIONAL } from '@/lib/site';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header>
      <div className="page">
        <div className={styles.masthead}>
          <Link href="/" className={styles.brand}>
            <span className={styles.wordmark}>{SITE_NAME}</span>
            <span className={styles.provisional}>{SITE_PROVISIONAL}</span>
          </Link>

          <nav aria-label="카테고리">
            <ul className={styles.nav}>
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className={styles.navLink}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.utility}>
            {/* 디자인의 검색·북마크 아이콘. 아직 어디에도 연결돼 있지 않다. */}
            <span className={`${styles.icon} ${styles.iconSearch}`} aria-hidden="true" />
            <span className={`${styles.icon} ${styles.iconBookmark}`} aria-hidden="true" />
            {/* 로그인 상태만 클라이언트에서 읽는다. 서버에서 읽으면 이 헤더를 쓰는
                모든 페이지가 동적 렌더링이 되어 ISR 이 사라진다. */}
            <AuthNav />
          </div>
        </div>
      </div>

      <div className="page">
        <div className="rule-thick" />
        <div className={styles.ruleGap} />
        <div className="rule-thin" />
      </div>
    </header>
  );
}
