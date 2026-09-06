'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GATE_COOKIE, adminAuthorId, checkPassword, isUnlocked, tokenFor } from '@/lib/adminGate';
import { isCategory } from '@/lib/categories';
import { adminClient } from '@/lib/supabase';
import type { PostStatus, ThumbRatio } from '@/lib/types';

export interface ActionState {
  error?: string;
}

const RATIOS: ThumbRatio[] = ['3:2', '3:4', '1:1'];

export async function unlock(_prev: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get('password') ?? '');
  if (!checkPassword(password)) return { error: '비밀번호가 맞지 않습니다.' };

  (await cookies()).set(GATE_COOKIE, tokenFor(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });

  redirect('/write');
}

export async function savePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isUnlocked())) return { error: '권한이 없습니다. 다시 로그인하세요.' };

  const rawId = String(form.get('id') ?? '');
  const id = rawId ? Number(rawId) : null;

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

  const db = adminClient();
  let postId: number;

  if (id) {
    const { error } = await db.from('posts').update(payload).eq('id', id);
    if (error) return { error: `저장에 실패했습니다: ${error.message}` };
    postId = id;
  } else {
    const { data, error } = await db
      .from('posts')
      .insert({ ...payload, author_id: adminAuthorId() })
      .select('id')
      .single();
    if (error) return { error: `저장에 실패했습니다: ${error.message}` };
    postId = data.id as number;
  }

  // 온디맨드 무효화(§2.3): 발행하면 홈·카테고리·상세가 60초를 기다리지 않고 갱신된다.
  revalidatePath('/');
  revalidatePath(`/category/${category}`);
  revalidatePath(`/p/${postId}`);
  revalidatePath('/feed.xml');

  redirect(status === 'published' ? `/p/${postId}` : `/write/${postId}`);
}
