import Link from 'next/link';
import styles from './page.module.css';

export default function NotFound() {
  return (
    <div className="page">
      <section className={styles.empty}>
        <h1 className={styles.emptyTitle}>찾는 글이 없습니다</h1>
        <p className={styles.emptyBody}>
          주소가 바뀌었거나, 아직 발행되지 않은 글일 수 있습니다.
        </p>
        <Link href="/" className={styles.emptyAction}>
          홈으로
        </Link>
      </section>
    </div>
  );
}
