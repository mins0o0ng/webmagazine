'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canWrite, currentProfile } from '@/lib/auth';
import { isCategory } from '@/lib/categories';
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
  // 기다리지 않고 갱신된다.
  revalidatePath('/');
  revalidatePath(`/category/${category}`);
  revalidatePath(`/p/${postId}`);
  revalidatePath(`/u/${authorHandle}`);
  revalidatePath('/feed.xml');

  redirect(status === 'published' ? `/p/${postId}` : `/write/${postId}`);
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
