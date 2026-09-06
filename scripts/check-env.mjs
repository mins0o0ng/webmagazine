#!/usr/bin/env node
/**
 * 빌드 전에 환경변수를 확인한다.
 *
 *   node scripts/check-env.mjs          빌드에 필요한 값이 없으면 종료 코드 1
 *   node scripts/check-env.mjs --warn   경고만 하고 통과 (개발 서버용)
 *
 * next.config.mjs 에서 던지지 않는 이유는 lib/env.mjs 주석 참고.
 */

import { ENV_HELP, blockingProblems, warnings } from '../lib/env.mjs';

const warnOnly = process.argv.includes('--warn');
const blocking = warnOnly ? [] : blockingProblems();
const soft = [...(warnOnly ? blockingProblems() : []), ...warnings()];

const line = '─'.repeat(66);

if (soft.length > 0) {
  console.error('');
  console.error(line);
  console.error('  참고');
  console.error(line);
  for (const s of soft) console.error(s);
  console.error(line);
  console.error('');
}

if (blocking.length === 0) process.exit(0);

console.error('');
console.error(line);
console.error('  빌드를 중단합니다');
console.error(line);
for (const b of blocking) console.error(b);
console.error('');
for (const h of ENV_HELP) console.error(h);
console.error('');
console.error('(의도적으로 건너뛰려면 SKIP_ENV_CHECK=1)');
console.error(line);
console.error('');

process.exit(1);
