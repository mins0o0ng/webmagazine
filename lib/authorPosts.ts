import { sessionClient } from './supabase';
import type { PostCategory, PostDetail, PostStatus } from './types';

/**
 * 필자 본인 시점의 읽기 (M2-1).
 *
 * M2 까지는 lib/adminPosts.ts 가 service_role 로 초안까지 읽었다. 그 파일은
 * 사라졌고, 여기는 전부 세션 클라이언트를 쓴다. 이유가 두 가지다.
 *
 *   1. RLS 가 실제로 일을 하게 된다. posts_read_published 정책이
 *      "발행글 또는 본인 글 또는 관리자" 를 이미 표현하고 있으므로, 애플리케이션이
 *      소유권을 다시 판정할 필요가 없다. 두 곳에서 판정하면 언젠가 어긋난다.
 *   2. service_role 키가 닿는 경로가 줄어든다. 기획안 §7 의 '높음' 리스크다.
 */

/** /me 목록에 필요한 만큼만. body 를 빼면 초안 수십 건도 한 자릿수 KB 다. */
export interface AuthoredPost {
  id: number;
  title: string;
  deck: string;
  category: PostCategory;
  status: PostStatus;
  thumbnail_url: string | null;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  /** 값이 있으면 노션이 원본이다. 사이트에서 고칠 수 없다(M2-4). */
  notion_page_id: string | null;
}

const AUTHORED_COLUMNS =
  'id, title, deck, category, status, thumbnail_url, like_count, comment_count, published_at, created_at, updated_at, notion_page_id';

/**
 * 내 글 전부 — 초안과 숨김 포함.
 *
 * 정렬은 updated_at 이다. 초안은 published_at 이 비어 있어서 발행일로 정렬하면
 * 쓰다 만 글이 전부 목록 바닥에 깔린다. 그건 이 화면이 있는 이유와 정반대다.
 */
export async function listMyPosts(authorId: string): Promise<AuthoredPost[]> {
  const db = await sessionClient();
  const { data, error } = await db
    .from('posts')
    .select(AUTHORED_COLUMNS)
    .eq('author_id', authorId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`내 글을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []) as unknown as AuthoredPost[];
}

/**
 * 수정 화면에서 읽는 글 한 건. 상태와 무관하게 읽지만 RLS 가 소유권을 건다 —
 * 남의 초안은 여기서 null 로 돌아오고, 남의 발행글은 읽히되 저장이 막힌다
 * (posts_update_own). 관리자는 둘 다 통과한다.
 */
export async function getEditablePost(id: number): Promise<PostDetail | null> {
  const db = await sessionClient();
  const { data, error } = await db
    .from('posts')
    .select('*, author:profiles!posts_author_id_fkey (handle, display_name, avatar_url)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`글을 불러오지 못했습니다: ${error.message}`);
  return (data as unknown as PostDetail) ?? null;
}
