import Link from 'next/link';
import styles from './NeedsInvite.module.css';

/**
 * 로그인은 했지만 기고 권한이 없는 사람이 /write 에 왔을 때 (M2-1).
 *
 * 404 로 보내지 않는 이유: 이 사람은 잘못 온 게 아니라 아직 초대받지 않았을 뿐이다.
 * "없는 페이지" 라고 하면 고장으로 읽힌다. README 가 M2 단독 배포를 두고 지적한
 * "가입은 했는데 아무것도 못 하는 상태" 가 바로 이 화면이 막으려는 것이다.
 */
export function NeedsInvite() {
  return (
    <div className={`page ${styles.wrap}`}>
      <p className="kicker">기고</p>
      <h1 className={styles.title}>아직 초대장이 없습니다</h1>

      <p className={styles.body}>
        이 지면은 초대받은 사람이 씁니다. 편집실이 기고 권한을 켜면 여기가 바로
        글쓰기 화면으로 바뀝니다. 다시 가입할 필요는 없습니다 — 지금 계정 그대로입니다.
      </p>

      <p className={styles.body}>
        읽는 데는 아무 제한이 없습니다. 좋아요와 댓글은 준비 중입니다.
      </p>

      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          지면으로 돌아가기
        </Link>
        <Link href="/about" className={styles.secondary}>
          이곳에 대하여
        </Link>
      </div>
    </div>
  );
}
