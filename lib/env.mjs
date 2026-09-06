/**
 * 빌드 시점 환경변수 검사.
 *
 * 왜 빌드에서 막는가: 이 값들이 없으면 앱은 빌드에 성공하고 배포까지 된 다음
 * 첫 방문자의 요청에서 500 으로 죽는다. Vercel 에 변수를 하나 빠뜨렸을 때
 * 그 사실을 사용자가 알려주는 것보다 빌드가 알려주는 편이 낫다.
 *
 * 검사를 건너뛰려면 SKIP_ENV_CHECK=1.
 */

const REQUIRED = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase 프로젝트 URL (Settings → API)'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon public 키. 클라이언트 노출이 정상이며 RLS 가 보호한다'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'service_role 키. 서버 전용 — NEXT_PUBLIC_ 접두사를 붙이면 안 된다'],
  ['ADMIN_PASSWORD', 'M1 에서 /write 를 막는 비밀번호'],
  ['ADMIN_AUTHOR_ID', 'supabase/seed.sql 로 만든 관리자 profile 의 UUID'],
];

export function checkEnv() {
  if (process.env.SKIP_ENV_CHECK === '1') return;

  const missing = REQUIRED.filter(([name]) => !process.env[name]);
  if (missing.length === 0) return;

  const lines = missing.map(([name, why]) => `  - ${name}\n      ${why}`).join('\n');
  throw new Error(
    `\n환경변수 ${missing.length}개가 없습니다.\n\n${lines}\n\n` +
      '로컬: .env.example 을 .env.local 로 복사해 채우세요.\n' +
      'Vercel: Settings → Environment Variables 에 추가한 뒤 재배포하세요.\n' +
      '(의도적으로 건너뛰려면 SKIP_ENV_CHECK=1)\n',
  );
}

/** service_role 키가 클라이언트에 노출되는 이름으로 들어오는 사고를 막는다(기획안 §7). */
export function checkNoLeakedSecrets() {
  const leaked = Object.keys(process.env).filter(
    (k) => k.startsWith('NEXT_PUBLIC_') && /SERVICE_ROLE|SECRET|PASSWORD/i.test(k),
  );
  if (leaked.length > 0) {
    throw new Error(
      `\nNEXT_PUBLIC_ 접두사가 붙은 비밀 값이 있습니다: ${leaked.join(', ')}\n` +
        'NEXT_PUBLIC_ 변수는 클라이언트 번들에 그대로 들어갑니다. 이름을 바꾸세요.\n',
    );
  }
}
