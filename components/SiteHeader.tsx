import Link from 'next/link';
import { CATEGORIES } from '@/lib/categories';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className="page">
        <div className={styles.top}>
          <Link href="/" className={styles.wordmark}>
            웹매거진
          </Link>
          <Link href="/write" className={styles.write}>
            글쓰기
          </Link>
        </div>

        <nav aria-label="카테고리">
          <ul className={styles.nav}>
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className={styles.navLink}>
                  {c.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/about" className={styles.navLink}>
                소개
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
