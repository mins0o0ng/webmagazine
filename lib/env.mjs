/**
 * 환경변수 검사.
 *
 * 빌드에 필요한 것과 런타임에만 필요한 것을 나눈다. 이 구분이 중요한 이유:
 *
 *   Vercel 의 Sensitive(자물쇠) 환경변수는 빌드 단계에 주입되지 않는다.
 *   서버리스 함수가 실행될 때만 들어온다. 그래서 런타임 전용 값을 빌드에서
 *   필수로 요구하면, 보안상 옳게 Sensitive 로 설정한 사람의 빌드가 깨진다.
 *
 * 반대로 NEXT_PUBLIC_ 값은 반드시 빌드에 있어야 한다. Next 가 그 값을 클라이언트
 * 번들에 그대로 박아 넣기 때문이다. 그래서 이 셋은 Sensitive 로 두면 안 되고,
 * 없으면 빌드를 세우는 게 맞다.
 *
 * 검사를 건너뛰려면 SKIP_ENV_CHECK=1.
 */

/**
 * 빌드 시점에 반드시 있어야 하는 값. 없으면 빌드를 중단한다.
 *
 * 이 둘만 넣은 이유: 없으면 앱이 데이터베이스에 아예 말을 걸 수 없다.
 * 그리고 NEXT_PUBLIC_ 이므로 빌드 때 클라이언트 번들에 박혀야 한다.
 */
const BUILD_REQUIRED = [
  [
    'NEXT_PUBLIC_SUPABASE_URL',
    'Supabase 프로젝트 URL (Settings → API → Project URL)',
  ],
  [
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'anon public 키. 클라이언트 노출이 정상이며 RLS 가 보호한다',
  ],
];

/**
 * 서버가 요청을 처리할 때 필요한 값. 빌드에서는 경고만 한다.
 * Vercel 에서 Sensitive 로 설정했다면 빌드에는 안 보이는 게 정상이기 때문이다.
 * 진짜로 없으면 첫 요청에서 lib/supabase.ts 의 required() 가 이름을 대며 실패한다.
 */
const RUNTIME_REQUIRED = [
  [
    'SUPABASE_SERVICE_ROLE_KEY',
    'service_role 키. 서버 전용 — NEXT_PUBLIC_ 접두사를 붙이면 안 된다',
  ],
  ['ADMIN_PASSWORD', 'M1 에서 /write 를 막는 비밀번호. 직접 정하면 된다'],
  ['ADMIN_AUTHOR_ID', 'supabase/seed.sql 로 만든 관리자 profile 의 UUID'],
];

/**
 * 없어도 빌드와 실행이 되지만 주소가 틀어지는 값.
 *
 * 빌드를 막지 않는 이유: 이 값은 배포 도메인인데, 첫 배포가 성공해야 도메인이
 * 나온다. 필수로 걸면 첫 배포를 영영 못 하는 닭과 달걀이 된다.
 */
const SHOULD_SET = [
  [
    'NEXT_PUBLIC_SITE_URL',
    'RSS 의 <link>, og:image 절대 경로, 매직링크가 돌아올 주소',
  ],
];

/** 빌드를 세워야 하는 문제들. 비어 있으면 이상 없음. */
export function blockingProblems() {
  if (process.env.SKIP_ENV_CHECK === '1') return [];

  const problems = [];

  const missing = BUILD_REQUIRED.filter(([name]) => !process.env[name]);
  if (missing.length > 0) {
    problems.push(`빌드에 필요한 환경변수 ${missing.length}개가 없습니다:`);
    for (const [name, why] of missing) problems.push(`  ${name}  —  ${why}`);
    problems.push('');
    problems.push('Vercel 이라면 Type 이 Secret 인지 확인하세요.');
    problems.push('Sensitive(자물쇠) 변수는 빌드에 주입되지 않습니다.');
    problems.push('NEXT_PUBLIC_ 값은 클라이언트 번들에 박히므로 Config 여야 합니다.');
  }

  // service_role 키가 클라이언트에 노출되는 이름으로 들어오는 사고를 막는다(기획안 §7).
  const leaked = Object.keys(process.env).filter(
    (k) => k.startsWith('NEXT_PUBLIC_') && /SERVICE_ROLE|SECRET|PASSWORD/i.test(k),
  );
  if (leaked.length > 0) {
    if (problems.length > 0) problems.push('');
    problems.push(`NEXT_PUBLIC_ 접두사가 붙은 비밀 값이 있습니다: ${leaked.join(', ')}`);
    problems.push('  NEXT_PUBLIC_ 변수는 클라이언트 번들에 그대로 들어갑니다. 이름을 바꾸세요.');
  }

  return problems;
}

/** 빌드를 세우지는 않지만 알려줄 문제들. */
export function warnings() {
  if (process.env.SKIP_ENV_CHECK === '1') return [];

  const lines = [];

  const runtime = RUNTIME_REQUIRED.filter(([name]) => !process.env[name]);
  if (runtime.length > 0) {
    lines.push(`런타임에 필요한 환경변수 ${runtime.length}개가 빌드에서 안 보입니다:`);
    for (const [name, why] of runtime) lines.push(`  ${name}  —  ${why}`);
    lines.push('');
    lines.push('Vercel 에서 Sensitive 로 설정했다면 정상입니다. 그 값들은 빌드가 아니라');
    lines.push('요청을 처리할 때 주입됩니다. 설정 자체를 빠뜨렸다면 배포된 사이트의');
    lines.push('첫 요청에서 어떤 변수가 없는지 이름과 함께 실패합니다.');
  }

  const should = SHOULD_SET.filter(([name]) => !process.env[name]);
  if (should.length > 0) {
    if (lines.length > 0) lines.push('');
    for (const [name, why] of should) {
      lines.push(`${name} 가 없습니다 — ${why}`);
    }
    lines.push('');
    lines.push('빌드는 계속됩니다. 다만 이 값이 없으면 localhost:3000 으로 폴백하므로');
    lines.push('배포된 RSS 와 로그인 메일의 링크가 로컬 주소를 가리킵니다.');
    lines.push('첫 배포로 도메인이 정해지면 그 값을 넣고 다시 배포하세요.');
  }

  return lines;
}

export const ENV_HELP = [
  '로컬:  .env.example 을 .env.local 로 복사해 채우세요.',
  'Vercel: Settings → Environment Variables. 추가한 뒤 Deployments 에서 Redeploy 해야',
  '        반영됩니다(환경변수 변경만으로는 다시 배포되지 않습니다).',
];
