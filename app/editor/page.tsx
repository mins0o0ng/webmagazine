import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ContributorToggle } from '@/components/editor/ContributorToggle';
import { InviteForm } from '@/components/editor/InviteForm';
import { InviteRow } from '@/components/editor/InviteRow';
import { NotionSync } from '@/components/editor/NotionSync';
import { isEditor, currentProfile } from '@/lib/auth';
import { listContributors, listInvites } from '@/lib/contributors';
import { notionEnabled } from '@/lib/notion';
import { authorPath } from '@/lib/format';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '편집실', robots: { index: false } };

export default async function EditorPage() {
  const profile = await currentProfile();
  if (!profile) redirect('/auth/complete');

  // 404 다. 403 을 주면 이 주소에 무언가 있다는 사실이 새어 나간다.
  if (!isEditor(profile)) notFound();

  const [people, invites] = await Promise.all([listContributors(), listInvites()]);
  const pending = invites.filter((i) => i.accepted_at === null);
  const accepted = invites.filter((i) => i.accepted_at !== null);
  const writers = people.filter((p) => p.can_write || p.is_admin);

  return (
    <div className={`page ${styles.wrap}`}>
      <header className={styles.head}>
        <div>
          <p className="kicker">편집실</p>
          <h1 className={styles.title}>누가 이 지면에 쓰는가</h1>
        </div>
        <p className={styles.summary}>
          기고자 {writers.length} · 대기 중인 초대 {pending.length}
        </p>
      </header>

      <div className="rule-thick" />

      <p className={styles.lede}>
        이 지면은 초대받은 사람이 씁니다. 가입은 누구나 할 수 있지만, 글은 여기서
        권한을 켠 사람만 쓸 수 있습니다. 아직 가입하지 않은 사람은 아래에서 주소로
        미리 초대해 두면, 그 주소로 가입하는 순간 권한이 켜집니다.
      </p>

      {/* --- 노션 (M2-4) ----------------------------------------------- */}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>노션에서 가져오기</h2>
        <div className="rule-thin" />
        <p className={styles.sectionLede}>
          노션 &ldquo;웹매거진 원고&rdquo; 데이터베이스에서 상태가 <strong>발행</strong>·
          <strong>초안</strong>·<strong>숨김</strong>인 행을 지면으로 옮깁니다. 자동으로도
          돌지만, 방금 바꾼 것을 바로 보고 싶으면 여기서 누르세요. 원본은 노션이라
          가져온 글은 사이트에서 편집할 수 없습니다.
        </p>
        <NotionSync enabled={notionEnabled()} />
      </section>

      {/* --- 초대 ------------------------------------------------------ */}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>초대하기</h2>
        <div className="rule-thin" />
        <InviteForm />
      </section>

      {pending.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>기다리는 초대</h2>
            <span className={styles.count}>{pending.length}</span>
          </div>
          <div className="rule-thin" />
          <ul>
            {pending.map((invite) => (
              <li key={invite.email}>
                <InviteRow invite={invite} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- 명단 ------------------------------------------------------ */}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>가입한 사람들</h2>
          <span className={styles.count}>{people.length}</span>
        </div>
        <div className="rule-thin" />

        {people.length === 0 ? (
          <p className={styles.empty}>아직 아무도 가입하지 않았습니다.</p>
        ) : (
          <ul>
            {people.map((person) => (
              <li key={person.id} className={styles.person}>
                <span className={`avatar ${styles.avatar}`} aria-hidden="true" />

                <div className={styles.personMain}>
                  <div className={styles.personName}>
                    <Link href={authorPath(person.handle)}>{person.display_name}</Link>
                    {person.is_admin && <span className={styles.badge}>편집장</span>}
                  </div>
                  <div className={styles.personMeta}>
                    @{person.handle} · 발행 {person.published_count}
                  </div>
                </div>

                <ContributorToggle
                  id={person.id}
                  name={person.display_name}
                  canWrite={person.can_write || person.is_admin}
                  isAdmin={person.is_admin}
                  isSelf={person.id === profile.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {accepted.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>수락된 초대</h2>
            <span className={styles.count}>{accepted.length}</span>
          </div>
          <div className="rule-thin" />
          <ul>
            {accepted.map((invite) => (
              <li key={invite.email}>
                <InviteRow invite={invite} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.footnote}>
        편집장 지정은 이 화면에 없습니다. profiles.is_admin 은 Supabase 대시보드에서만
        바뀝니다 — 편집장을 애플리케이션에서 만들 수 있으면 그 경로가 곧 권한 상승
        경로가 됩니다.
      </p>
    </div>
  );
}
