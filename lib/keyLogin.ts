import 'server-only';

/**
 * 편집실 열쇠 — 임시 통로의 켜짐/꺼짐 (M2-2).
 *
 * app/auth/actions.ts 에 두지 않는 이유: 그 파일은 'use server' 라서 모든 export
 * 가 async 함수여야 한다. 이건 값을 읽는 동기 함수다.
 *
 * server-only 를 import 하는 이유: ADMIN_EMAIL 은 NEXT_PUBLIC_ 이 아니므로
 * 클라이언트 번들에서는 어차피 undefined 지만, 그러면 "열쇠가 꺼져 있다" 로
 * 조용히 잘못 판단하게 된다. 실수로 클라이언트에서 import 하면 빌드가 멈추는 편이 낫다.
 */
export function keyLoginEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return raw ? raw : null;
}
