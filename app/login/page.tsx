import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../page.module.css';

export const metadata: Metadata = { title: '로그인', robots: { index: false } };

/**
 * 디자인 2b 의 마스트헤드에 "로그인"이 있어 그대로 두었지만, 실제 인증은 M2 다
 * (기획안 §6). 링크가 404 로 떨어지지 않도록 놓아둔 자리다.
 * Supabase Auth 매직링크가 붙을 때 이 파일이 로그인 폼으로 교체된다.
 */
export default function LoginPage() {
  return (
    <div className="page">
      <section className={styles.empty}>
        <h1 className={styles.emptyTitle}>로그인은 아직 열지 않았습니다</h1>
        <p className={styles.emptyBody}>
          지금은 편집자만 글을 올립니다. 계정 기능은 다음 단계에서 열립니다.
        </p>
        <Link href="/" className={styles.emptyAction}>
          홈으로
        </Link>
      </section>
    </div>
  );
}
