import { PICK } from './categories';
import { publicClient } from './supabase';
import type { AuthorRef, PostCategory, PostDetail, PostSummary } from './types';

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
  /** 홈에서 이미 검정 띠로 나간 에디터 픽을 피드에서 빼기 위해 쓴다. */
  excludeId?: number;
}

/** 발행된 글을 최신순으로. posts_feed_idx 가 그대로 타는 쿼리다. */
export async function listPublished({
  category,
  limit = 20,
  offset = 0,
  excludeId,
}: FeedOptions = {}): Promise<PostSummary[]> {
  let query = publicClient()
    .from('posts')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (excludeId !== undefined) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`글 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []) as unknown as PostSummary[];
}

/** 홈의 검정 띠에 들어갈 최신 에디터 픽 한 건. */
export async function getEditorsPick(): Promise<PostSummary | null> {
  const [pick] = await listPublished({ category: PICK, limit: 1 });
  return pick ?? null;
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

export interface MonthlyAuthor extends AuthorRef {
  post_count: number;
}

/**
 * 홈 하단 "이번 달에 쓴 사람들".
 *
 * Postgres 쪽 group by 대신 이번 달 글만 받아 JS 에서 집계한다. 한 달 발행량은
 * 많아야 수십 건이라 이 편이 뷰나 RPC 를 하나 더 만드는 것보다 싸다.
 * 발행량이 세 자릿수로 올라가면 그때 집계 뷰로 옮긴다.
 */
export async function listMonthlyAuthors(): Promise<MonthlyAuthor[]> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { data, error } = await publicClient()
    .from('posts')
    .select(`author_id, ${AUTHOR}`)
    .eq('status', 'published')
    .gte('published_at', monthStart.toISOString());

  if (error) throw new Error(`필자 목록을 불러오지 못했습니다: ${error.message}`);

  const rows = (data ?? []) as unknown as { author_id: string; author: AuthorRef }[];
  const byAuthor = new Map<string, MonthlyAuthor>();

  for (const row of rows) {
    if (!row.author) continue;
    const existing = byAuthor.get(row.author_id);
    if (existing) {
      existing.post_count += 1;
    } else {
      byAuthor.set(row.author_id, { ...row.author, post_count: 1 });
    }
  }

  return [...byAuthor.values()].sort((a, b) => b.post_count - a.post_count);
}

export function postPath(id: number): string {
  // 숫자 ID. 한글 제목을 슬러그로 만들면 퍼센트 인코딩으로 주소가 읽을 수 없게 길어진다(§3.3).
  return `/p/${id}`;
}

/** 리드·상세용 전체 날짜. 디자인 표기: 2026. 09. 04 */
export function formatDateFull(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}. ${mm}. ${dd}`;
}

/** 카드용 축약 날짜. 디자인 표기: 09. 03 */
export function formatDateShort(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}. ${dd}`;
}

/** 디자인의 좋아요 표기: 1000 이상은 "1.2천". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}천`;
}
