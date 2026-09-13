import { PICK } from './categories';
import { runQuery } from './retry';
import { publicClient } from './supabase';
import type { AuthorRef, PostCategory, PostDetail, PostSummary, Profile } from './types';

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
  const data = await runQuery('글 목록을 불러오지 못했습니다', () => {
    let query = publicClient()
      .from('posts')
      .select(SUMMARY_COLUMNS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (excludeId !== undefined) query = query.neq('id', excludeId);
    return query;
  });

  return (data ?? []) as unknown as PostSummary[];
}

/** 홈의 검정 띠에 들어갈 최신 에디터 픽 한 건. */
export async function getEditorsPick(): Promise<PostSummary | null> {
  const [pick] = await listPublished({ category: PICK, limit: 1 });
  return pick ?? null;
}

export async function getPublishedPost(id: number): Promise<PostDetail | null> {
  const data = await runQuery('글을 불러오지 못했습니다', () =>
    publicClient()
      .from('posts')
      .select(DETAIL_COLUMNS)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle(),
  );

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

  const data = await runQuery('필자 목록을 불러오지 못했습니다', () =>
    publicClient()
      .from('posts')
      .select(`author_id, ${AUTHOR}`)
      .eq('status', 'published')
      .gte('published_at', monthStart.toISOString()),
  );

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

/* --- 필자 페이지 /u/[handle] (M2-1) ------------------------------------
 * 전부 anon 클라이언트로 읽는다. 이 페이지는 ISR 이므로 쿠키를 보면 안 된다
 * (lib/supabase.ts publicClient 주석 참고). */

/** 핸들로 공개 프로필을 찾는다. profiles 는 RLS 상 전체 공개다. */
export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const data = await runQuery('필자를 불러오지 못했습니다', () =>
    publicClient()
      .from('profiles')
      .select('*')
      .eq('handle', handle.toLowerCase())
      .maybeSingle(),
  );

  return (data as Profile | null) ?? null;
}

/**
 * 한 사람의 발행글. posts_author_published_idx 를 그대로 타는 쿼리다(마이그레이션 4).
 *
 * author_id 로 거른다. 핸들로 거르면 조인 결과에 필터가 걸려 인덱스를 못 탄다.
 */
export async function listPublishedByAuthor(
  authorId: string,
  limit = 30,
): Promise<PostSummary[]> {
  const data = await runQuery('글 목록을 불러오지 못했습니다', () =>
    publicClient()
      .from('posts')
      .select(SUMMARY_COLUMNS)
      .eq('author_id', authorId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit),
  );

  return (data ?? []) as unknown as PostSummary[];
}
