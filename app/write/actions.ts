'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canWrite, currentProfile } from '@/lib/auth';
import { isCategory } from '@/lib/categories';
import { parseDrafts } from '@/lib/importMarkdown';
import { sessionClient } from '@/lib/supabase';
import type { PostStatus, Profile, ThumbRatio } from '@/lib/types';

export interface ActionState {
  error?: string;
}

const RATIOS: ThumbRatio[] = ['3:2', '3:4', '1:1'];

/**
 * 글쓰기 게이트 (M2-1).
 *
 * M1·M2 의 ADMIN_PASSWORD 자물쇠(lib/adminGate.ts)는 여기서 사라졌다. 이제
 * 로그인 세션이 신원이고, 기고 권한은 profiles.can_write 다.
 *
 * 이 함수가 마지막 방어선이 아니라는 점이 중요하다. 진짜 차단은 RLS 의
 * posts_insert_own / posts_update_own 이 한다(마이그레이션 4). 여기서 미리
 * 막는 이유는 사람이 읽을 수 있는 문구를 주기 위해서다 — RLS 가 막으면
 * "0행 영향" 이 돌아올 뿐이라 화면에 띄울 말이 없다.
 */
async function gate(): Promise<{ profile: Profile } | { error: string }> {
  const profile = await currentProfile();
  if (!profile) return { error: '로그인이 필요합니다.' };
  if (!canWrite(profile)) {
    return { error: '기고 권한이 없습니다. 편집실의 초대가 필요합니다.' };
  }
  return { profile };
}

export async function savePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  const gated = await gate();
  if ('error' in gated) return { error: gated.error };
  const { profile } = gated;

  const rawId = String(form.get('id') ?? '');
  const id = rawId ? Number(rawId) : null;
  if (rawId && !Number.isSafeInteger(id)) return { error: '알 수 없는 글입니다.' };

  const title = String(form.get('title') ?? '').trim();
  const deck = String(form.get('deck') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const category = String(form.get('category') ?? '');
  const status = String(form.get('status') ?? 'draft') as PostStatus;
  const thumbnailUrl = String(form.get('thumbnail_url') ?? '').trim();
  const rawRatio = String(form.get('thumbnail_ratio') ?? '');

  // deck 은 스키마에서 not null 이다(§3.2 — 선택으로 두면 아무도 안 쓰고 카드가 무너진다).
  // DB 제약에 부딪히기 전에 여기서 사람이 읽을 수 있는 문구로 막는다.
  if (!title) return { error: '제목을 입력하세요.' };
  if (!deck) return { error: '부제를 입력하세요. 카드 레이아웃이 부제를 전제로 합니다.' };
  if (!body) return { error: '본문을 입력하세요.' };
  if (!isCategory(category)) return { error: '카테고리를 선택하세요.' };
  if (status !== 'draft' && status !== 'published') return { error: '알 수 없는 상태입니다.' };

  const ratio = RATIOS.includes(rawRatio as ThumbRatio) ? (rawRatio as ThumbRatio) : null;

  const payload = {
    title,
    deck,
    body,
    category,
    status,
    thumbnail_url: thumbnailUrl || null,
    // 썸네일이 없으면 비율도 의미가 없다. 남겨두면 카드가 빈 비율로 자리를 잡는다.
    thumbnail_ratio: thumbnailUrl ? ratio : null,
  };

  // service_role 이 아니라 세션 클라이언트다. author_id 를 폼에서 받지 않고
  // 세션에서 꺼내므로, 남의 이름으로 쓰는 경로가 애초에 없다.
  const db = await sessionClient();
  let postId: number;
  let authorHandle = profile.handle;

  if (id) {
    // 노션이 원본인 글은 여기서 막는다(M2-4). 열어두면 사이트에서 고친 내용을
    // 다음 동기화가 말없이 덮어쓴다 — 사라진 줄도 모르는 편집이 가장 나쁘다.
    const { data: source } = await db
      .from('posts')
      .select('notion_page_id')
      .eq('id', id)
      .maybeSingle();
    if (source?.notion_page_id) {
      return { error: '이 글은 노션이 원본입니다. 노션에서 고치면 곧 반영됩니다.' };
    }

    // RLS 가 남의 글을 막지만, 막힌 결과는 오류가 아니라 "0행 영향" 으로 온다.
    // .select() 를 붙여 반환된 행으로 판정한다 — 이걸 error 로만 보면
    // 저장에 실패했는데 성공 화면이 뜬다.
    const { data, error } = await db
      .from('posts')
      .update(payload)
      .eq('id', id)
      .select('id, author:profiles!posts_author_id_fkey (handle)');

    if (error) return { error: `저장에 실패했습니다: ${error.message}` };
    if (!data || data.length === 0) {
      return { error: '이 글을 수정할 권한이 없습니다.' };
    }
    postId = id;
    // 관리자가 남의 글을 고칠 수 있으므로 필자 페이지는 글의 필자 것을 비운다.
    const joined = data[0] as unknown as { author?: { handle?: string } };
    authorHandle = joined.author?.handle ?? profile.handle;
  } else {
    const { data, error } = await db
      .from('posts')
      .insert({ ...payload, author_id: profile.id })
      .select('id')
      .single();

    if (error) return { error: `저장에 실패했습니다: ${error.message}` };
    postId = data.id as number;
  }

  // 온디맨드 무효화(§2.3): 발행하면 홈·카테고리·상세·필자 페이지가 60초를
  // 기다리지 않고 갱신된다. 서버 액션 안에서 부르므로 브라우저의 라우터 캐시도
  // 함께 비워진다 — 발행 직후 홈으로 돌아가도 옛 지면이 보이지 않는다.
  revalidatePath('/');
  revalidatePath(`/category/${category}`);
  revalidatePath(`/p/${postId}`);
  revalidatePath(`/u/${authorHandle}`);
  revalidatePath('/feed.xml');
  revalidatePath('/me');

  redirect(status === 'published' ? `/p/${postId}` : `/write/${postId}`);
}

export interface ImportState {
  error?: string;
  /** 만들어진 초안. 화면이 여기에 바로 링크를 건다. */
  created?: { id: number; title: string; warnings: string[] }[];
}

/**
 * 붙여넣은 원고를 초안으로 만든다 (M2-3).
 *
 * 반드시 draft 로 들어간다. 발행은 사람이 각 글을 열어 부제와 카테고리를 채운 뒤
 * 누른다 — 그 둘은 편집 결정이지 파서가 정할 일이 아니다(seed_posts.sql 주석).
 *
 * 이 액션이 supabase/seed_posts.sql 같은 파일을 대신한다. 원고를 넣겠다고
 * INSERT 문을 손으로 짜고 SQL Editor 를 여는 경로는 여기서 끝난다.
 */
export async function importDrafts(_prev: ImportState, form: FormData): Promise<ImportState> {
  const gated = await gate();
  if ('error' in gated) return { error: gated.error };
  const { profile } = gated;

  const raw = String(form.get('text') ?? '');
  if (!raw.trim()) return { error: '가져올 원고를 붙여넣으세요.' };

  const drafts = parseDrafts(raw);
  if (drafts.length === 0) return { error: '원고를 찾지 못했습니다.' };

  // 한 번에 너무 많이 들어오면 실수다. 「산책자」 전체가 28편이라 넉넉히 잡는다.
  if (drafts.length > 50) {
    return { error: `${drafts.length}편이 인식됐습니다. 50편 이하로 나눠 넣으세요.` };
  }

  const db = await sessionClient();

  // deck·body 는 not null 이다. 파서가 비워둔 자리는 사람이 채울 자리표시자를 넣는다.
  // 빈 문자열을 넣으면 /me 목록에서 어느 글이 덜 됐는지 보이지 않는다.
  const rows = drafts.map((d) => ({
    author_id: profile.id,
    title: d.title || '(제목 없음)',
    deck: d.deck || '(부제를 아직 쓰지 않았습니다)',
    body: d.body || ' ',
    category: d.category ?? 'essay',
    status: 'draft' as const,
    thumbnail_url: null,
    thumbnail_ratio: null,
  }));

  const { data, error } = await db.from('posts').insert(rows).select('id, title');
  if (error) return { error: `가져오지 못했습니다: ${error.message}` };

  revalidatePath('/me');

  return {
    created: (data ?? []).map((row, i) => ({
      id: row.id as number,
      title: row.title as string,
      // 카테고리를 못 찾아 essay 로 넣었다면 그 사실을 반드시 알려야 한다.
      warnings: drafts[i]?.warnings ?? [],
    })),
  };
}

export interface AutosaveResult {
  /** 새 글이 처음 저장되며 받은 id. 이후 자동저장은 이 id 로 이어진다. */
  id?: number;
  savedAt?: number;
  error?: string;
  /** 저장하지 않고 넘어갔다는 뜻. 오류가 아니다. */
  skipped?: boolean;
}

/**
 * 초안 자동저장 (M2-2).
 *
 * 왜 필요한가: 지금까지 PostEditor 는 그냥 useState 였다. 3천 자짜리 원고를 쓰다가
 * 탭이 닫히거나 세션이 만료되면 통째로 사라진다. 긴 글을 받는 매체에서 이건
 * 기능 부족이 아니라 결함이다 — 기고자가 한 번 겪으면 다시 쓰지 않는다.
 *
 * 규칙 두 가지가 중요하다.
 *
 *   1. **발행된 글은 자동저장하지 않는다.** 지면에 나가 있는 글을 사람이 저장을
 *      누르지도 않았는데 덮어쓰면 안 된다. 발행글 수정 중의 안전망은 브라우저
 *      쪽 초안 복구(useDraftRecovery)가 맡는다.
 *   2. 제목이 없으면 저장하지 않는다. 빈 글이 /me 목록에 쌓이면 그 화면이
 *      쓸모없어진다.
 */
export async function autosaveDraft(form: FormData): Promise<AutosaveResult> {
  const gated = await gate();
  if ('error' in gated) return { error: gated.error };
  const { profile } = gated;

  const rawId = String(form.get('id') ?? '');
  const id = rawId ? Number(rawId) : null;
  if (rawId && !Number.isSafeInteger(id)) return { error: '알 수 없는 글입니다.' };

  const title = String(form.get('title') ?? '').trim();
  const deck = String(form.get('deck') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const category = String(form.get('category') ?? '');
  const thumbnailUrl = String(form.get('thumbnail_url') ?? '').trim();
  const rawRatio = String(form.get('thumbnail_ratio') ?? '');

  if (!title) return { skipped: true };

  // deck·body 는 not null 이라 빈 문자열이라도 넣어야 행이 만들어진다.
  // 사람이 저장을 누를 때는 savePost 가 제대로 된 문구로 막는다.
  const payload = {
    title,
    deck: deck || '(부제를 아직 쓰지 않았습니다)',
    body: body || ' ',
    category: isCategory(category) ? category : 'essay',
    thumbnail_url: thumbnailUrl || null,
    thumbnail_ratio: thumbnailUrl
      ? RATIOS.includes(rawRatio as ThumbRatio)
        ? (rawRatio as ThumbRatio)
        : null
      : null,
  };

  const db = await sessionClient();

  if (id) {
    // 발행된 글인지 먼저 본다. RLS 상 본인 글만 읽히므로 이 조회 자체가 소유권 검사다.
    const { data: current } = await db
      .from('posts')
      .select('status, notion_page_id')
      .eq('id', id)
      .maybeSingle();

    if (!current) return { error: '이 글을 저장할 권한이 없습니다.' };
    if (current.notion_page_id) return { skipped: true };  // 노션이 원본이다(M2-4)
    if (current.status !== 'draft') return { skipped: true };

    const { data, error } = await db.from('posts').update(payload).eq('id', id).select('id');
    if (error) return { error: `자동저장에 실패했습니다: ${error.message}` };
    if (!data || data.length === 0) return { error: '이 글을 저장할 권한이 없습니다.' };

    // revalidatePath 를 부르지 않는다. 초안은 어느 캐시된 지면에도 나가지 않고,
    // 몇 초마다 홈 캐시를 비우면 자동저장이 사이트 성능 문제가 된다.
    return { id, savedAt: Date.now() };
  }

  const { data, error } = await db
    .from('posts')
    .insert({ ...payload, status: 'draft', author_id: profile.id })
    .select('id')
    .single();

  if (error) return { error: `자동저장에 실패했습니다: ${error.message}` };
  return { id: data.id as number, savedAt: Date.now() };
}

/**
 * 내 글 지우기 (/me).
 *
 * 소프트 삭제가 아니라 진짜 삭제다. 댓글과 좋아요는 posts 의 on delete cascade 로
 * 함께 사라진다. 발행된 글을 실수로 지우는 사고를 막는 확인은 화면 쪽에 있다.
 *
 * 권한 회수(can_write = false)를 당한 사람도 자기 글은 지울 수 있다 —
 * posts_delete_own 정책을 일부러 손대지 않았다(마이그레이션 4 주석).
 */
export async function deletePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await currentProfile();
  if (!profile) return { error: '로그인이 필요합니다.' };

  const id = Number(String(form.get('id') ?? ''));
  if (!Number.isSafeInteger(id) || id <= 0) return { error: '알 수 없는 글입니다.' };

  const db = await sessionClient();
  const { data, error } = await db.from('posts').delete().eq('id', id).select('id, category');

  if (error) return { error: `삭제하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { error: '이 글을 삭제할 권한이 없습니다.' };

  const category = (data[0] as { category: string }).category;
  revalidatePath('/');
  revalidatePath(`/category/${category}`);
  revalidatePath(`/u/${profile.handle}`);
  revalidatePath('/feed.xml');
  revalidatePath('/me');

  return {};
}
