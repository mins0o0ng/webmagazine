'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabaseBrowser';
import styles from '../SiteHeader.module.css';

type State =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; name: string; canWrite: boolean };

/**
 * 마스트헤드의 로그인 표시.
 *
 * 서버에서 렌더하지 않는 이유는 lib/supabaseBrowser.ts 주석 참고 — 홈·카테고리의
 * ISR 을 지키기 위해서다. 결정될 때까지는 자리만 비워둔다. 로딩 중에 "로그인"을
 * 먼저 보여주면 로그인한 사용자에게 깜박임이 생긴다.
 *
 * M2-1: 기고 권한이 있는 사람에게만 "쓰기" 를 보인다. 여기서 감추는 것은 안내일
 * 뿐이고, 실제 차단은 /write 의 can_write 검사와 RLS 가 한다. profiles 는 RLS 상
 * 전체 공개라 can_write 는 anon 키로도 읽힌다 — 감출 값이 아니다.
 */
export function AuthNav() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const router = useRouter();

  useEffect(() => {
    const supabase = browserClient();
    let alive = true;

    async function load(userId: string | undefined) {
      if (!userId) {
        if (alive) setState({ status: 'out' });
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('display_name, can_write, is_admin')
        .eq('id', userId)
        .maybeSingle();
      if (!alive) return;
      setState({
        status: 'in',
        name: data?.display_name ?? '나',
        canWrite: Boolean(data?.can_write || data?.is_admin),
      });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user?.id));

    // 다른 탭에서 로그인·로그아웃하면 여기도 따라간다.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user?.id);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.status === 'loading') {
    return <span className={styles.authSlot} aria-hidden="true" />;
  }

  if (state.status === 'out') {
    return (
      <span className={styles.authSlot}>
        <Link href="/login">로그인</Link>
      </span>
    );
  }

  return (
    <span className={styles.authSlot}>
      {state.canWrite && (
        <Link href="/write" className={styles.write}>
          쓰기
        </Link>
      )}
      <Link href="/me" className={styles.who}>
        {state.name}
      </Link>
      <button
        type="button"
        className={styles.linkButton}
        onClick={async () => {
          await browserClient().auth.signOut();
          router.refresh();
        }}
      >
        로그아웃
      </button>
    </span>
  );
}
