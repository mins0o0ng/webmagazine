export type PostStatus = 'draft' | 'published' | 'hidden';
export type PostCategory = 'essay' | 'place' | 'love' | 'life' | 'pick';
export type ThumbRatio = '3:2' | '3:4' | '1:1';

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Post {
  id: number;
  author_id: string;
  title: string;
  deck: string;
  body: string;
  category: PostCategory;
  status: PostStatus;
  thumbnail_url: string | null;
  thumbnail_ratio: ThumbRatio | null;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 카드/목록에 필요한 만큼만. body 를 빼면 홈 응답이 한 자릿수 KB 로 떨어진다. */
export type PostSummary = Omit<Post, 'body'> & { author: AuthorRef };

export type PostDetail = Post & { author: AuthorRef };

export interface AuthorRef {
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

/** 썸네일 비율 → CSS aspect-ratio. 이미지 로딩 전에 자리를 확정하기 위한 값(§3.2). */
export const RATIO_CSS: Record<ThumbRatio, string> = {
  '3:2': '3 / 2',
  '3:4': '3 / 4',
  '1:1': '1 / 1',
};
