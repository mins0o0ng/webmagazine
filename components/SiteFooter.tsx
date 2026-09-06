import Link from 'next/link';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="page">
        <div className="rule-thick" />
        <div className={styles.row}>
          <div>
            <div className={styles.wordmark}>{SITE_NAME}</div>
            <p className={styles.tagline}>{SITE_TAGLINE}</p>
          </div>

          <ul className={styles.links}>
            <li>
              <Link href="/about">소개</Link>
            </li>
            {/* M2 에서 가입이 열리면서 실제 법적 의무가 됐다(기획안 §6 M2).
                두 문서 모두 아직 초안이며 채워야 할 항목이 남아 있다. */}
            <li>
              <Link href="/legal/terms">이용약관</Link>
            </li>
            <li>
              <Link href="/legal/privacy">개인정보</Link>
            </li>
            <li>
              <Link href="/feed.xml">RSS</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
