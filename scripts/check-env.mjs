#!/usr/bin/env node
/**
 * 빌드 전에 환경변수를 확인한다.
 *
 *   node scripts/check-env.mjs          문제가 있으면 종료 코드 1
 *   node scripts/check-env.mjs --warn   경고만 하고 통과 (개발 서버용)
 *
 * next.config.mjs 에서 던지지 않는 이유는 lib/env.mjs 주석 참고.
 */

import { ENV_HELP, envProblems } from '../lib/env.mjs';

const warnOnly = process.argv.includes('--warn');
const problems = envProblems();

if (problems.length === 0) process.exit(0);

const line = '─'.repeat(64);
const label = warnOnly ? '경고' : '빌드를 중단합니다';

console.error('');
console.error(line);
console.error(`  ${label}`);
console.error(line);
for (const p of problems) console.error(p);
console.error('');
for (const h of ENV_HELP) console.error(h);
console.error('');
console.error('(의도적으로 건너뛰려면 SKIP_ENV_CHECK=1)');
console.error(line);
console.error('');

process.exit(warnOnly ? 0 : 1);
