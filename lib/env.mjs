/**
 * 환경변수 검사.
 *
 * 왜 빌드에서 막는가: 이 값들이 없으면 앱은 빌드에 성공하고 배포까지 된 다음
 * 첫 방문자의 요청에서 500 으로 죽는다. Vercel 에 변수를 하나 빠뜨렸을 때
 * 그 사실을 사용자가 알려주는 것보다 빌드가 알려주는 편이 낫다.
 *
 * next.config.mjs 가 아니라 scripts/check-env.mjs 에서 부른다. 설정 파일에서
 * 던지면 Next 가 "Failed to load next.config.mjs" 로 감싸버려서 정작 어떤 변수가
 * 없는지가 묻힌다.
 *
 * 검사를 건너뛰려면 SKIP_ENV_CHECK=1.
 */

const REQUIRED = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase 프로젝트 URL (Settings → API → Project URL)'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon public 키. 클라이언트 노출이 정상이며 RLS 가 보호한다'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'service_role 키. 서버 전용 — NEXT_PUBLIC_ 접두사를 붙이면 안 된다'],
  ['ADMIN_PASSWORD', 'M1 에서 /write 를 막는 비밀번호. 직접 정하면 된다'],
  ['ADMIN_AUTHOR_ID', 'supabase/seed.sql 로 만든 관리자 profile 의 UUID'],
];

/** 문제를 사람이 읽을 수 있는 줄들로 돌려준다. 비어 있으면 이상 없음. */
export function envProblems() {
  if (process.env.SKIP_ENV_CHECK === '1') return [];

  const problems = [];

  const missing = REQUIRED.filter(([name]) => !process.env[name]);
  if (missing.length > 0) {
    problems.push(`환경변수 ${missing.length}개가 없습니다:`);
    for (const [name, why] of missing) problems.push(`  ${name}  —  ${why}`);
  }

  // service_role 키가 클라이언트에 노출되는 이름으로 들어오는 사고를 막는다(기획안 §7).
  const leaked = Object.keys(process.env).filter(
    (k) => k.startsWith('NEXT_PUBLIC_') && /SERVICE_ROLE|SECRET|PASSWORD/i.test(k),
  );
  if (leaked.length > 0) {
    problems.push(`NEXT_PUBLIC_ 접두사가 붙은 비밀 값이 있습니다: ${leaked.join(', ')}`);
    problems.push('  NEXT_PUBLIC_ 변수는 클라이언트 번들에 그대로 들어갑니다. 이름을 바꾸세요.');
  }

  return problems;
}

export const ENV_HELP = [
  '로컬:  .env.example 을 .env.local 로 복사해 채우세요.',
  'Vercel: Settings → Environment Variables 에 추가하고 Production/Preview/Development 를',
  '        모두 체크한 뒤, Deployments 에서 Redeploy 하세요.',
  '        (환경변수를 추가해도 자동으로 다시 배포되지 않습니다.)',
];
