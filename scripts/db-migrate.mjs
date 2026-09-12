#!/usr/bin/env node
/**
 * 마이그레이션 실행기.
 *
 *   npm run db:migrate            아직 안 돌린 파일만 순서대로
 *   npm run db:migrate -- --dry   무엇이 돌아갈지만 본다
 *   npm run db:migrate -- --adopt 이미 손으로 만든 DB 의 현재 상태를 인정하고 기록만 한다
 *   npm run db:migrate -- --redo 20260906020000_lock_anon.sql
 *
 * 왜 만들었나: 지금까지는 supabase/migrations/ 의 파일을 사람이 SQL Editor 에
 * 하나씩 붙여넣어야 했다. 파일이 넷이 되면서 "순서대로 전부 돌렸는가" 를 사람이
 * 기억해야 하는 상태가 됐고, 그건 기억으로 관리할 일이 아니다.
 *
 * 실행 이력은 DB 의 schema_migrations 에 남는다. 그래서 몇 번을 돌려도
 * 안 돌린 것만 돌아간다.
 *
 * DATABASE_URL 이 필요하다 — service_role 키로는 임의 SQL 을 실행할 수 없다
 * (PostgREST 는 테이블만 노출한다). Supabase 대시보드
 * Settings → Database → Connection string → URI 를 한 번만 복사해 .env.local 에 넣는다.
 *
 * 이미 존재하는 DB: M1~M2 를 SQL Editor 에서 손으로 실행한 프로젝트에는
 * schema_migrations 기록이 없다. 그대로 돌리면 1번부터 다시 실행하려다
 * "이미 존재함" 으로 멈춘다. 그래서 각 마이그레이션 파일 첫 줄에
 *
 *   -- applied-if: <true/false 를 돌려주는 SQL>
 *
 * 를 심어 두었다. --adopt 는 그 질의를 돌려 이미 적용된 파일을 실행하지 않고
 * 기록만 한다. 기록이 비어 있는데 스키마가 이미 있으면 그냥 실행하지 않고
 * --adopt 를 쓰라고 멈춘다 — 남의 DB 를 반쯤 밟는 것보다 낫다.
 *
 * 트랜잭션: 파일 하나가 통째로 한 트랜잭션이다. 중간에 실패하면 그 파일은
 * 아무것도 적용되지 않는다. `ALTER TYPE ... ADD VALUE` 처럼 트랜잭션 안에서
 * 돌 수 없는 문장이 필요하면 파일 첫 줄에 `-- no-transaction` 을 적는다.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(`
DATABASE_URL 이 없습니다.

  Supabase 대시보드 → Settings → Database → Connection string → URI 를 복사해
  .env.local 에 넣으세요. [YOUR-PASSWORD] 자리는 프로젝트를 만들 때 정한
  데이터베이스 비밀번호입니다 (잊었다면 같은 화면에서 재설정할 수 있습니다).

  DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres

  service_role 키로는 안 됩니다 — 그 키는 테이블만 다루고 DDL 은 못 돌립니다.
`);
  process.exit(2);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const adopt = args.includes('--adopt');
const redo = args.includes('--redo') ? args[args.indexOf('--redo') + 1] : null;

/**
 * Supabase 는 TLS 를 쓰지만 인증서 체인이 로컬 신뢰 저장소에 없는 경우가 많다.
 * 연결 자체는 암호화되고 대상 호스트를 우리가 직접 적었으므로 이 설정으로 붙인다.
 *
 * 로컬 Postgres(`supabase start` 나 개발용 인스턴스)는 TLS 를 안 켜는 게 보통이라
 * 호스트를 보고 끈다. 켜면 붙지 않는다.
 */
function isLocal(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

const client = new pg.Client({
  connectionString: url,
  ssl: isLocal(url) ? false : { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  await client.query(`
    create table if not exists schema_migrations (
      name   text primary key,
      run_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('마이그레이션 파일이 없습니다.');
    return;
  }

  const { rows } = await client.query('select name from schema_migrations');
  const done = new Set(rows.map((r) => r.name));

  if (redo) {
    if (!files.includes(redo)) {
      throw new Error(`그런 파일이 없습니다: ${redo}\n  있는 파일: ${files.join(', ')}`);
    }
    done.delete(redo);
    console.log(`--redo ${redo}\n`);
  }

  let pending = redo ? [redo] : files.filter((f) => !done.has(f));

  /* --- 이미 손으로 만든 DB 를 인정한다 ------------------------------------ */
  if (!redo && pending.length > 0) {
    const already = [];
    for (const name of pending) {
      const sql = await readFile(path.join(DIR, name), 'utf8');
      const probe = sql.match(/^\s*--\s*applied-if:\s*(.+)$/m)?.[1]?.trim();
      if (!probe) continue;
      try {
        const { rows: r } = await client.query(`select (${probe}) as hit`);
        if (r[0]?.hit === true) already.push(name);
      } catch {
        // 판별 질의가 실패하면 "아직 아님" 으로 본다. 실행기가 대신 판단하지 않는다.
      }
    }

    if (already.length > 0 && !adopt) {
      console.log('이 데이터베이스에는 이미 적용된 마이그레이션이 있습니다:');
      for (const f of already) console.log(`  ${f}`);
      console.log('');
      console.log('기록(schema_migrations)에는 없지만 스키마에는 있습니다.');
      console.log('SQL Editor 에서 손으로 실행한 프로젝트에서 흔한 상태입니다.');
      console.log('');
      console.log('그대로 실행하면 "이미 존재함" 으로 멈춥니다. 현재 상태를 인정하려면:');
      console.log('');
      console.log('  npm run db:migrate -- --adopt');
      console.log('');
      console.log('위 파일들을 실행하지 않고 적용된 것으로 기록한 뒤,');
      console.log('나머지만 순서대로 돌립니다.');
      process.exitCode = 2;
      return;
    }

    if (adopt && already.length > 0) {
      console.log(`이미 적용된 것으로 기록합니다 (${already.length}개, 실행하지 않음):`);
      for (const name of already) {
        await client.query(
          'insert into schema_migrations (name) values ($1) on conflict do nothing',
          [name],
        );
        console.log(`  ${name}  기록만`);
      }
      console.log('');
      pending = pending.filter((f) => !already.includes(f));
    }
  }

  if (pending.length === 0) {
    console.log(`이미 최신입니다. (${files.length}개 전부 적용됨)`);
    return;
  }

  console.log(`적용할 마이그레이션 ${pending.length}개:`);
  for (const f of pending) console.log(`  ${f}`);
  console.log('');

  if (dryRun) {
    console.log('--dry 이므로 실행하지 않았습니다.');
    return;
  }

  for (const name of pending) {
    const sql = await readFile(path.join(DIR, name), 'utf8');
    // 첫 줄의 지시자. 트랜잭션 안에서 돌 수 없는 문장이 있는 파일용.
    const inTransaction = !/^\s*--\s*no-transaction/m.test(sql.slice(0, 200));

    process.stdout.write(`  ${name} ... `);
    try {
      if (inTransaction) await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1) on conflict do nothing', [
        name,
      ]);
      if (inTransaction) await client.query('commit');
      console.log('OK');
    } catch (err) {
      if (inTransaction) await client.query('rollback').catch(() => {});
      console.log('실패');
      console.error(`\n${name} 에서 멈췄습니다:\n  ${err.message}\n`);
      if (inTransaction) {
        console.error('이 파일의 변경은 롤백됐습니다. 앞의 파일들은 적용된 상태입니다.');
        console.error('고친 뒤 다시 돌리면 남은 것부터 이어서 실행합니다.\n');
      }
      throw err;
    }
  }

  console.log('\n끝났습니다. 다음: supabase/check_rls.sql 로 권한을 확인하세요.');
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    await client.end().catch(() => {});
    if (!/에서 멈췄습니다/.test(err.message)) console.error(`\n${err.message}\n`);
    process.exit(1);
  });
