import type { PostCategory } from './types';

/**
 * 라벨은 디자인 2b 의 마스트헤드 표기를 그대로 따른다 — 영문 대문자, 자간 .18em.
 *
 * 기획안 §3.1 이 카테고리를 Postgres enum 으로 못박았다. enum 은 변경에
 * 마이그레이션이 필요한데(§8 도 인정) 카테고리는 매거진에서 가장 자주 바뀌는 축이다.
 * 표시 이름과 순서만이라도 코드에 두면 라벨 변경은 마이그레이션 없이 끝나고,
 * 나중에 lookup 테이블로 옮길 때의 이음매가 된다.
 */
export const CATEGORIES: { slug: PostCategory; label: string }[] = [
  { slug: 'essay', label: 'ESSAY' },
  { slug: 'place', label: 'PLACE' },
  { slug: 'love', label: 'LOVE' },
  { slug: 'life', label: 'LIFE' },
  { slug: 'pick', label: "EDITOR'S PICK" },
];

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

/** 에디터 픽은 홈에서 검정 띠로 따로 나가므로 일반 피드와 구분해 다룬다. */
export const PICK: PostCategory = 'pick';

export function isCategory(value: string): value is PostCategory {
  return BY_SLUG.has(value as PostCategory);
}

export function categoryLabel(slug: PostCategory): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}
