import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const GATE_COOKIE = 'wm_admin';

/**
 * M1 한정 인증 게이트 (§6 M1: "환경변수에 심은 관리자 비밀번호 하나로 막는다").
 *
 * 한계를 분명히 해둔다: 이건 사용자 인증이 아니라 자물쇠 하나다. 비밀번호가 새면
 * 그걸로 끝이고, 누가 썼는지 남지 않는다. M2 에서 Supabase Auth 세션으로 통째로
 * 교체되는 코드이며, 그때 이 파일은 삭제된다.
 */
function expectedToken(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('환경변수 ADMIN_PASSWORD 가 설정되지 않았습니다.');
  return createHash('sha256').update(password).digest('hex');
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function tokenFor(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function checkPassword(password: string): boolean {
  return safeEquals(tokenFor(password), expectedToken());
}

export async function isUnlocked(): Promise<boolean> {
  const token = (await cookies()).get(GATE_COOKIE)?.value;
  if (!token) return false;
  return safeEquals(token, expectedToken());
}

export function adminAuthorId(): string {
  const id = process.env.ADMIN_AUTHOR_ID;
  if (!id) {
    throw new Error(
      'ADMIN_AUTHOR_ID 가 없습니다. supabase/seed.sql 로 관리자 profile 을 먼저 만드세요.',
    );
  }
  return id;
}
