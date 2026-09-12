'use server';

import { currentProfile } from '@/lib/auth';
import { sessionClient } from '@/lib/supabase';

/**
 * 좋아요·댓글 서버 액션 (M3 · M3-1).
 *
 * 전부 세션 클라이언트로 돈다. service_role 은 쓰지 않는다 — RLS 가 이미
 * "본인 것만" 을 표현하고 있으므로 우회할 이유가 없다(마이그레이션 6).
 *
 * revalidatePath 를 부르지 않는 것이 중요하다. 글 상세는 ISR 이고, 좋아요 한 번에
 * 지면 캐시를 비우면 인기 글일수록 캐시가 무의미해진다. 화면은 낙관적 업데이트로
 * 즉시 반응하고, 카드에 찍히는 숫자는 다음 재생성 때 따라잡는다(§2.3).
 */

export interface LikeResult {
  liked?: boolean;
  count?: number;
  error?: string;
}

/** 눌렀으면 취소하고, 안 눌렀으면 누른다. 카운터는 DB 트리거가 맞춘다. */
export async function toggleLike(postId: number): Promise<LikeResult> {
  if (!Number.isSafeInteger(postId) || postId <= 0) return { error: '알 수 없는 글입니다.' };

  const profile = await currentProfile();
  if (!profile) return { error: '로그인이 필요합니다.' };

  const db = await sessionClient();
  const key = profile.id;

  // 지금 눌러져 있는지. likes_read_self 상 본인 행만 보이므로 이 조회 자체가
  // 소유권 검사다.
  const { data: mine } = await db
    .from('likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('actor_key', key)
    .maybeSingle();

  if (mine) {
    const { error } = await db
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('actor_key', key);
    if (error) return { error: `취소하지 못했습니다: ${error.message}` };
  } else {
    const { error } = await db
      .from('likes')
      .insert({ post_id: postId, actor_key: key, user_id: profile.id });
    // 23505 = 이미 있음. 두 탭에서 동시에 누른 경우이므로 오류가 아니다.
    if (error && error.code !== '23505') {
      return { error: `누르지 못했습니다: ${error.message}` };
    }
  }

  // 트리거가 반영한 뒤의 값을 그대로 돌려준다. 화면이 자기 추정치로 표시하면
  // 다른 탭에서 누른 것과 어긋난다.
  const { data: post } = await db
    .from('posts')
    .select('like_count')
    .eq('id', postId)
    .maybeSingle();

  return { liked: !mine, count: (post?.like_count as number) ?? 0 };
}

export interface CommentResult {
  error?: string;
  ok?: boolean;
}

export async function addComment(postId: number, body: string): Promise<CommentResult> {
  if (!Number.isSafeInteger(postId) || postId <= 0) return { error: '알 수 없는 글입니다.' };

  const profile = await currentProfile();
  if (!profile) return { error: '로그인이 필요합니다.' };

  // DB 에도 같은 제약이 있다(comments_body_length). 여기서 먼저 막는 이유는
  // 사람이 읽을 수 있는 문구를 주기 위해서다.
  const text = body.trim();
  if (!text) return { error: '댓글을 입력하세요.' };
  if (text.length > 2000) return { error: '댓글은 2000자까지입니다.' };

  const db = await sessionClient();
  const { error } = await db
    .from('comments')
    .insert({ post_id: postId, author_id: profile.id, body: text });

  if (error) return { error: `남기지 못했습니다: ${error.message}` };
  return { ok: true };
}

/**
 * 소프트 삭제. 행을 지우지 않고 deleted_at 을 채운다(§3.2).
 *
 * 하드 삭제를 쓰지 않는 이유: 댓글이 사라지면 그 아래 대화의 맥락이 끊긴다.
 * 카운터는 comments_sync_count 트리거가 UPDATE 도 처리하므로 알아서 내려간다.
 *
 * 정책상 본인 또는 편집장만 통과한다(comments_update_own).
 */
export async function removeComment(commentId: number): Promise<CommentResult> {
  if (!Number.isSafeInteger(commentId) || commentId <= 0) {
    return { error: '알 수 없는 댓글입니다.' };
  }

  const profile = await currentProfile();
  if (!profile) return { error: '로그인이 필요합니다.' };

  const db = await sessionClient();
  const { data, error } = await db
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)
    .is('deleted_at', null)
    .select('id');

  if (error) return { error: `지우지 못했습니다: ${error.message}` };
  // RLS 가 막으면 오류가 아니라 0행으로 온다.
  if (!data || data.length === 0) return { error: '이 댓글을 지울 권한이 없습니다.' };

  return { ok: true };
}
