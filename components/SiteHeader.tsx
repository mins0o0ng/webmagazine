import Link from 'next/link';
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
            <span className={`${styles.icon} ${styles.iconSearch}`} aria-hidden="true" />
            <span className={`${styles.icon} ${styles.iconBookmark}`} aria-hidden="true" />
            <Link href="/login">로그인</Link>
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
