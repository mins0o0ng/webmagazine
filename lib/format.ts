/**
 * 경로와 표기 — 순수 함수만.
 *
 * lib/posts.ts 에서 떼어낸 이유가 있다. posts.ts 는 lib/supabase.ts 를 import 하고,
 * supabase.ts 는 next/headers 를 import 한다. 그래서 클라이언트 컴포넌트가
 * 날짜 표기 하나 때문에 posts.ts 를 부르면 빌드가 통째로 실패한다
 * ("You're importing a component that needs next/headers").
 *
 * 이 파일에는 DB 도 쿠키도 들어오지 않는다. 서버·클라이언트 어느 쪽에서든 쓴다.
 */

export function postPath(id: number): string {
  // 숫자 ID. 한글 제목을 슬러그로 만들면 퍼센트 인코딩으로 주소가 읽을 수 없게 길어진다(§3.3).
  return `/p/${id}`;
}

export function authorPath(handle: string): string {
  return `/u/${handle}`;
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
