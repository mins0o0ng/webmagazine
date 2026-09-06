import { adminClient } from './supabase';
import type { PostDetail } from './types';

/**
 * 상태와 무관하게 글 한 건을 읽는다. 초안 수정 화면에 필요하다.
 * RLS 를 우회하므로 반드시 게이트를 통과한 뒤에만 호출할 것.
 */
export async function getAnyPost(id: number): Promise<PostDetail | null> {
  const { data, error } = await adminClient()
    .from('posts')
    .select(
      '*, author:profiles!posts_author_id_fkey (handle, display_name, avatar_url)',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`글을 불러오지 못했습니다: ${error.message}`);
  return (data as unknown as PostDetail) ?? null;
}
