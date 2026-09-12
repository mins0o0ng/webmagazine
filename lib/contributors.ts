import { adminClient } from './supabase';
import type { ContributorInvite, Profile } from './types';

/**
 * 편집실(/editor)이 쓰는 읽기·쓰기 (M2-1).
 *
 * 전부 service_role 이다. 이 파일의 함수를 부르기 전에 호출자가 반드시
 * is_admin 을 확인해야 한다 — RLS 를 우회하므로 DB 는 더 이상 막아주지 않는다.
 *
 *   profiles.can_write / is_admin 은 컬럼 GRANT 에서 빠져 있어(마이그레이션 4)
 *   authenticated 롤로는 아예 쓸 수 없다. 그래서 권한 부여만큼은 service_role
 *   경로가 불가피하다. 그 대가로 이 파일은 서버에서만, 게이트 뒤에서만 돈다.
 *
 *   contributor_invites 는 RLS 가 켜져 있고 정책이 하나도 없다. 즉 anon 키로도,
 *   로그인 사용자 키로도 한 행도 읽히지 않는다. 이메일이 들어 있기 때문이다.
 */

export interface ContributorRow extends Profile {
  /** 발행글 수. 권한을 회수해도 되는 사람인지 판단하는 데 쓴다. */
  published_count: number;
}

/**
 * 가입자 명단. 이메일은 auth.users 에만 있고 여기 없다 — 이 화면은 이메일을
 * 보여주지 않는다. 편집장이 직접 입력한 초대 주소만 아래 listInvites 로 나온다.
 *
 * 페이지네이션이 없다. 가입자가 200명을 넘으면 그때 검색을 붙인다.
 */
export async function listContributors(): Promise<ContributorRow[]> {
  const db = adminClient();

  const [{ data: profiles, error }, { data: posts }] = await Promise.all([
    db.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('posts').select('author_id').eq('status', 'published'),
  ]);

  if (error) throw new Error(`명단을 불러오지 못했습니다: ${error.message}`);

  // Postgres group by 대신 JS 집계. lib/posts.ts 의 listMonthlyAuthors 와 같은
  // 판단이다 — 이 규모에서는 뷰나 RPC 를 하나 더 만드는 것보다 싸다.
  const counts = new Map<string, number>();
  for (const row of (posts ?? []) as { author_id: string }[]) {
    counts.set(row.author_id, (counts.get(row.author_id) ?? 0) + 1);
  }

  return ((profiles ?? []) as Profile[]).map((p) => ({
    ...p,
    published_count: counts.get(p.id) ?? 0,
  }));
}

/** 초대장 목록. 아직 수락되지 않은 것이 위로 온다. */
export async function listInvites(): Promise<ContributorInvite[]> {
  const { data, error } = await adminClient()
    .from('contributor_invites')
    .select('*')
    .order('accepted_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`초대 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []) as ContributorInvite[];
}

/**
 * 가입할 때 초대장을 확인하고 기고 권한을 켠다. auth 콜백에서 부른다.
 *
 * 초대장이 없으면 아무 일도 하지 않는다 — 가입 자체는 누구나 되고, 이 함수는
 * 기고 권한만 다룬다.
 *
 * 실패해도 던지지 않는다. 여기서 던지면 가입 자체가 실패하는데, 그건 훨씬 나쁘다.
 * 초대가 반영되지 않으면 편집장이 명단에서 직접 켤 수 있다.
 */
export async function claimInvite(email: string | undefined, profileId: string): Promise<boolean> {
  if (!email) return false;
  const db = adminClient();

  try {
    const { data: invite } = await db
      .from('contributor_invites')
      .select('email, accepted_at')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!invite) return false;

    // 이미 수락된 초대장으로 두 번째 계정을 만들 수는 없다. 같은 주소로는 계정이
    // 하나뿐이므로 정상 경로에서는 걸리지 않지만, 계정을 지웠다 다시 만드는
    // 경로가 남아 있다.
    if (invite.accepted_at) return false;

    const { error } = await db
      .from('profiles')
      .update({ can_write: true })
      .eq('id', profileId);
    if (error) throw error;

    await db
      .from('contributor_invites')
      .update({ accepted_at: new Date().toISOString(), accepted_by: profileId })
      .eq('email', invite.email);

    return true;
  } catch (err) {
    console.error('[contrib] claimInvite failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
