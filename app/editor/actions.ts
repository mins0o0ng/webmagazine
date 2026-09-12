'use server';

import { revalidatePath } from 'next/cache';
import { isEditor, currentProfile, validateEmail } from '@/lib/auth';
import { syncFromNotion, type SyncOutcome } from '@/lib/notionSync';
import { adminClient } from '@/lib/supabase';

export interface EditorState {
  error?: string;
  ok?: string;
}

/**
 * 편집실의 쓰기 동작 (M2-1).
 *
 * 전부 service_role 로 돈다 — profiles.can_write 와 contributor_invites 는
 * authenticated 롤이 아예 건드릴 수 없기 때문이다(마이그레이션 4). 그래서 이
 * 파일에서는 DB 가 권한을 막아주지 않는다. 게이트가 유일한 방어선이다.
 *
 * 모든 액션이 gate() 로 시작해야 한다. 하나라도 빠지면 로그인한 아무나
 * 스스로에게 기고 권한을 줄 수 있다.
 */
async function gate(): Promise<{ id: string } | { error: string }> {
  const profile = await currentProfile();
  if (!isEditor(profile)) return { error: '편집실 권한이 없습니다.' };
  return { id: profile!.id };
}

/* --- 노션 동기화 (M2-4) ------------------------------------------------ */

export interface SyncState {
  error?: string;
  ok?: string;
  outcomes?: SyncOutcome[];
}

/**
 * 사람이 누르는 동기화. 자동 실행은 Vercel Cron 이
 * app/api/sync/notion/route.ts 를 부른다.
 *
 * "필자 핸들" 이 빈 노션 행은 지금 누른 편집장 앞으로 저장된다.
 */
export async function runNotionSync(_prev: SyncState, _form: FormData): Promise<SyncState> {
  const gated = await gate();
  if ('error' in gated) return { error: gated.error };

  const report = await syncFromNotion(gated.id);
  if (!report.ran) return { error: report.error };

  const changed = report.outcomes.filter(
    (o) => o.action === 'created' || o.action === 'updated',
  );
  const failed = report.outcomes.filter((o) => o.action === 'failed');

  if (changed.length > 0) {
    revalidatePath('/');
    revalidatePath('/feed.xml');
    for (const o of changed) {
      if (o.postId !== undefined) revalidatePath(`/p/${o.postId}`);
    }
    for (const slug of ['essay', 'place', 'love', 'life', 'pick']) {
      revalidatePath(`/category/${slug}`);
    }
  }
  revalidatePath('/editor');

  return {
    ok:
      `노션 ${report.outcomes.length}행을 확인했습니다 — ` +
      `${changed.length}건 반영` +
      (failed.length > 0 ? `, ${failed.length}건 실패` : ''),
    outcomes: report.outcomes,
  };
}

/** 아직 가입하지 않은 사람을 미리 초대해둔다. 가입 시 auth 콜백이 권한을 켠다. */
export async function inviteContributor(
  _prev: EditorState,
  form: FormData,
): Promise<EditorState> {
  const gated = await gate();
  if ('error' in gated) return { error: gated.error };

  const email = validateEmail(String(form.get('email') ?? ''));
  if (!email.ok) return { error: email.error };

  const note = String(form.get('note') ?? '').trim().slice(0, 200);

  // upsert 다. 같은 주소를 두 번 초대해도 오류가 아니라 메모만 갱신된다.
  // 다만 이미 수락된 초대장을 되살리지는 않는다 — accepted_at 을 건드리지 않는다.
  const { error } = await adminClient()
    .from('contributor_invites')
    .upsert(
      {
        email: email.email,
        note: note || null,
        invited_by: gated.id,
      },
      { onConflict: 'email' },
    );

  if (error) return { error: `초대하지 못했습니다: ${error.message}` };

  revalidatePath('/editor');
  return { ok: `${email.email} 을 초대 명단에 넣었습니다.` };
}

/**
 * 초대장 취소. 이미 수락된 초대장을 지워도 권한은 회수되지 않는다 —
 * 권한은 profiles.can_write 에 있고, 회수는 아래 setContributor 가 한다.
 */
export async function revokeInvite(_prev: EditorState, form: FormData): Promise<EditorState> {
  const gated = await gate();
  if ('error' in gated) return { error: gated.error };

  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: '주소가 없습니다.' };

  const { error } = await adminClient()
    .from('contributor_invites')
    .delete()
    .eq('email', email);

  if (error) return { error: `취소하지 못했습니다: ${error.message}` };

  revalidatePath('/editor');
  return { ok: `${email} 초대를 지웠습니다.` };
}

/** 이미 가입한 사람의 기고 권한을 켜고 끈다. */
export async function setContributor(
  _prev: EditorState,
  form: FormData,
): Promise<EditorState> {
  const gated = await gate();
  if ('error' in gated) return { error: gated.error };

  const targetId = String(form.get('id') ?? '');
  const grant = String(form.get('grant') ?? '') === 'on';
  if (!targetId) return { error: '대상이 없습니다.' };

  const db = adminClient();

  const { data: target, error: readError } = await db
    .from('profiles')
    .select('id, handle, display_name, is_admin')
    .eq('id', targetId)
    .maybeSingle();

  if (readError) return { error: `명단을 읽지 못했습니다: ${readError.message}` };
  if (!target) return { error: '없는 사람입니다.' };

  // 편집장의 기고 권한은 can_write 와 무관하다(may_write() 가 is_admin 도 본다).
  // 여기서 끄면 화면에는 꺼진 것처럼 보이는데 실제로는 계속 쓸 수 있다 —
  // 그 불일치를 만들지 않는다.
  if (target.is_admin && !grant) {
    return { error: '편집장의 기고 권한은 끌 수 없습니다. 먼저 편집장에서 내려야 합니다.' };
  }

  const { error } = await db
    .from('profiles')
    .update({ can_write: grant })
    .eq('id', targetId);

  if (error) return { error: `바꾸지 못했습니다: ${error.message}` };

  revalidatePath('/editor');
  return {
    ok: grant
      ? `${target.display_name} 에게 기고 권한을 주었습니다.`
      : `${target.display_name} 의 기고 권한을 거뒀습니다.`,
  };
}
