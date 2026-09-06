import { publicClient } from './supabase';
import type { PostCategory, PostDetail, PostSummary } from './types';

/** author 조인. profiles 는 RLS 상 전체 공개라 anon 클라이언트로 읽힌다. */
const AUTHOR = 'author:profiles!posts_author_id_fkey (handle, display_name, avatar_url)';

const SUMMARY_COLUMNS = `
  id, author_id, title, deck, category, status,
  thumbnail_url, thumbnail_ratio, like_count, comment_count,
  published_at, created_at, updated_at,
  ${AUTHOR}
`;

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, body`;

export interface FeedOptions {
  category?: PostCategory;
  limit?: number;
  offset?: number;
}

/** 발행된 글을 최신순으로. posts_feed_idx 가 그대로 타는 쿼리다. */
export async function listPublished({
  category,
  limit = 20,
  offset = 0,
}: FeedOptions = {}): Promise<PostSummary[]> {
  let query = publicClient()
    .from('posts')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw new Error(`글 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []) as unknown as PostSummary[];
}

export async function getPublishedPost(id: number): Promise<PostDetail | null> {
  const { data, error } = await publicClient()
    .from('posts')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw new Error(`글을 불러오지 못했습니다: ${error.message}`);
  return (data as unknown as PostDetail) ?? null;
}

export function postPath(id: number): string {
  // 숫자 ID. 한글 제목을 슬러그로 만들면 퍼센트 인코딩으로 주소가 읽을 수 없게 길어진다(§3.3).
  return `/p/${id}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
