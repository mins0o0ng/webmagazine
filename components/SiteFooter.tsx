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
            {/* 이용약관·개인정보처리방침은 가입 기능이 붙는 M2 부터 실제 법적 의무가
                생긴다(기획안 §6 M2). 디자인에도 링크가 아닌 글자로 놓여 있어,
                문서가 생길 때까지 링크를 걸지 않는다 — 빈 페이지를 만들지 않기 위해서다. */}
            <li>이용약관</li>
            <li>개인정보</li>
            <li>
              <Link href="/feed.xml">RSS</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
