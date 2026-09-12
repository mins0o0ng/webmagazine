#!/usr/bin/env node
/**
 * 접속 문자열을 만든다.
 *
 * 왜 따로 파일을 뒀나. DATABASE_URL 은 사람이 손으로 조립하는 유일한 값이고,
 * 지금까지 실패한 원인은 전부 조립 과정이었다. 그중 고칠 수 없는 게 하나 있다 —
 * Supabase 는 데이터베이스 비밀번호에 특수문자를 요구하는데, 그 특수문자가
 * URL 안에 들어가면 URL 을 깨뜨린다. @ 는 호스트 구분자고 : 는 포트 구분자,
 * / 는 경로 구분자, # 는 프래그먼트 구분자다. 사람에게 %40 으로 바꿔 적으라고
 * 시키는 건 실패하는 절차다.
 *
 * 그래서 비밀번호를 URL 에서 떼어낸다.
 *
 *   SUPABASE_DATABASE_URL   대시보드에서 복사한 그대로. [YOUR-PASSWORD] 그대로 둔다.
 *   SUPABASE_DB_PASSWORD    비밀번호 원문. 인코딩하지 않는다. 여기서 대신 한다.
 *
 * 비밀번호를 따로 주지 않으면 URL 을 그대로 쓴다 — 예전 방식도 계속 동작한다.
 *
 * 이 파일은 어디서도 비밀번호를 찍지 않는다. 로그가 CI 에 남는다.
 */

const PLACEHOLDER = /^\[?(?:YOUR[-_]PASSWORD|PASSWORD|비밀번호)\]?$/i;

/**
 * postgres URL 을 조각낸다. WHATWG URL 파서를 쓰지 않는 이유: 아직 인코딩되지
 * 않은 비밀번호나 [YOUR-PASSWORD] 자리표시자가 들어 있으면 파싱 자체가 어긋난다.
 * 사용자명에는 @ 도 : 도 못 들어가므로 앞에서 끊고, 비밀번호는 마지막 @ 까지로 본다.
 */
function split(raw) {
  const m = raw.match(/^(postgres(?:ql)?:\/\/)([^:@/]+)(?::(.*))?@([^@]+)$/s);
  if (!m) return null;
  return { scheme: m[1], user: m[2], password: m[3] ?? '', rest: m[4] };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ url: string, source: string } | { error: string[] }}
 */
export function resolveDatabaseUrl(env = process.env) {
  const base = env.DATABASE_URL ?? env.SUPABASE_DB_URL ?? '';
  const password = env.SUPABASE_DB_PASSWORD ?? '';

  if (!base) {
    return {
      error: [
        'SUPABASE_DATABASE_URL 이 없습니다.',
        '',
        '  Supabase 대시보드 → Connect → Session pooler 의 문자열을 그대로 복사하세요.',
        '  [YOUR-PASSWORD] 는 지우지 말고 그대로 두고, 비밀번호는 원문 그대로',
        '  SUPABASE_DB_PASSWORD 에 따로 넣으면 됩니다 (인코딩 필요 없음).',
      ],
    };
  }

  const parts = split(base.trim());
  if (!parts) {
    return {
      error: [
        'SUPABASE_DATABASE_URL 이 postgres 접속 문자열 형식이 아닙니다.',
        '  postgresql://<사용자>:<비밀번호>@<호스트>:<포트>/postgres 여야 합니다.',
      ],
    };
  }

  const hasPlaceholder = PLACEHOLDER.test(parts.password);

  if (password) {
    // 원문을 받아 여기서 한 번만 인코딩한다. 사람이 %40 을 적을 일이 없다.
    const url = `${parts.scheme}${parts.user}:${encodeURIComponent(password)}@${parts.rest}`;
    return { url, source: 'SUPABASE_DB_PASSWORD' };
  }

  if (hasPlaceholder || parts.password === '') {
    return {
      error: [
        'SUPABASE_DATABASE_URL 의 비밀번호 자리가 아직 [YOUR-PASSWORD] 입니다.',
        '',
        '  URL 을 고치지 말고, 비밀번호 원문을 SUPABASE_DB_PASSWORD 에 넣으세요.',
        '  특수문자를 인코딩할 필요 없습니다 — 실행기가 대신 합니다.',
      ],
    };
  }

  return { url: base.trim(), source: 'SUPABASE_DATABASE_URL' };
}

/** 비밀번호를 지운 형태. 로그에 찍어도 되는 유일한 표현. */
export function redact(url) {
  const p = split(url);
  return p ? `${p.scheme}${p.user}:***@${p.rest}` : '(형식 불명)';
}

// 워크플로에서 psql 에 넘길 값을 만들 때 직접 실행한다.
//   node scripts/db-url.mjs        → 접속 문자열을 stdout 으로
//   node scripts/db-url.mjs --show → 비밀번호를 가린 형태로
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = resolveDatabaseUrl();
  if ('error' in r) {
    for (const line of r.error) console.error(line);
    process.exit(2);
  }
  process.stdout.write(process.argv.includes('--show') ? `${redact(r.url)}\n` : r.url);
}
