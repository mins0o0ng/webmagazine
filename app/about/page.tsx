import type { Metadata } from 'next';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';
import styles from './page.module.css';

export const metadata: Metadata = { title: '소개' };

export default function AboutPage() {
  return (
    <div className="page">
      <article className={styles.about}>
        <p className="kicker">ABOUT</p>
        <h1 className={styles.title}>{SITE_NAME}</h1>
        <p className={styles.tagline}>{SITE_TAGLINE}</p>
        <div className="rule-thin" />
        {/* 실제 소개 문구는 편집 결정 사항이라 비워둔다. */}
        <p className={styles.body}>소개 문구를 아직 쓰지 않았습니다.</p>
      </article>
    </div>
  );
}
