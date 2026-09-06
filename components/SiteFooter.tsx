import Link from 'next/link';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="page">
        <div className={styles.row}>
          <p>© {new Date().getFullYear()} 웹매거진</p>
          <ul className={styles.links}>
            <li>
              <Link href="/about">소개</Link>
            </li>
            <li>
              <Link href="/feed.xml">RSS</Link>
            </li>
            {/* 개인정보처리방침·이용약관은 M2 에서 실제 법적 의무가 생긴다(§6 M2).
                가입 기능이 붙기 전에 링크만 먼저 만들면 빈 페이지가 남는다. */}
          </ul>
        </div>
      </div>
    </footer>
  );
}
