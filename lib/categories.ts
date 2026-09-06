import type { PostCategory } from './types';

/**
 * 기획안 §3.1 이 카테고리를 Postgres enum 으로 못박았다.
 *
 * 우려: 카테고리는 매거진에서 가장 자주 바뀌는 축인데 enum 은 변경에 마이그레이션이
 * 필요하다(§8 이 스스로 인정). 표시 이름과 순서만이라도 여기 코드에 두면,
 * 라벨 변경은 마이그레이션 없이 끝나고 enum 값 자체를 바꿔야 할 때도
 * 손댈 곳이 이 파일 하나로 좁혀진다. 나중에 lookup 테이블로 옮길 때의 이음매이기도 하다.
 */
export const CATEGORIES: { slug: PostCategory; label: string }[] = [
  { slug: 'essay', label: '에세이' },
  { slug: 'place', label: '공간' },
  { slug: 'love', label: '사랑' },
  { slug: 'life', label: '생활' },
  { slug: 'pick', label: '픽' },
];

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function isCategory(value: string): value is PostCategory {
  return BY_SLUG.has(value as PostCategory);
}

export function categoryLabel(slug: PostCategory): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}
