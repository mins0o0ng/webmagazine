export type PostStatus = 'draft' | 'published' | 'hidden';
export type PostCategory = 'essay' | 'place' | 'love' | 'life' | 'pick';
export type ThumbRatio = '3:2' | '3:4' | '1:1';

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  /** 편집실 권한. 초대·권한 회수와 남의 글 수정까지 할 수 있다. */
  is_admin: boolean;
  /** 기고 권한 (M2-1). 편집실에서만 켜고 끈다 — 본인은 못 바꾼다. */
  can_write: boolean;
  created_at: string;
}

/**
 * 아직 가입하지 않은 사람을 위한 초대장 (M2-1).
 * 이메일이 들어 있으므로 service_role 로만 읽는다. RLS 상 정책이 하나도 없다.
 */
export interface ContributorInvite {
  email: string;
  note: string | null;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
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
  /** 원본 노션 페이지 (M2-4). 값이 있으면 사이트에서 편집할 수 없다. */
  notion_page_id: string | null;
  notion_synced_at: string | null;
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
