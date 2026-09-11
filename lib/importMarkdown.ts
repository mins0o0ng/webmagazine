import { isCategory } from './categories';
import type { PostCategory } from './types';

/**
 * 붙여넣은 원고를 글 단위로 쪼갠다 (M2-3).
 *
 * 왜 필요한가: M1 이후로 원고를 사이트에 넣는 경로가 두 개였다 — /write 에서
 * 직접 쓰거나, supabase/seed_posts.sql 처럼 INSERT 문을 손으로 만들어 SQL Editor
 * 에서 실행하거나. 노션에 이미 써둔 글은 늘 후자였고, 그건 "글 한 편 올리려면
 * SQL 을 짠다" 는 뜻이다. 이 파서가 그 경로를 없앤다.
 *
 * 입력은 사람이 복사해 붙여넣은 덩어리다. 규칙을 최소로 둔다 —
 * 노션에서 그대로 복사해도 통과해야 하기 때문이다.
 *
 *   1. `===` 만 있는 줄이 글과 글의 경계다.
 *   2. 각 글의 첫 `# 제목` 줄이 제목이다. 없으면 첫 줄을 제목으로 쓰고 본문에서 뺀다.
 *   3. 제목 바로 다음 `> 부제` 줄이 있으면 부제다.
 *   4. `[카테고리: essay]` 같은 줄이 있으면 카테고리다.
 *
 * 3·4 가 없어도 된다. 없으면 비워서 돌려주고, 채우는 일은 사람이 화면에서 한다 —
 * 부제와 카테고리는 편집 결정이지 기계가 정할 일이 아니다(seed_posts.sql 주석).
 */

export interface ParsedDraft {
  title: string;
  deck: string;
  category: PostCategory | null;
  body: string;
  /** 사람이 확인해야 할 것. 화면에 그대로 보여준다. */
  warnings: string[];
}

const SEPARATOR = /^\s*={3,}\s*$/;
const HEADING = /^#\s+(.+?)\s*$/;
const DECK = /^>\s?(.+?)\s*$/;
const CATEGORY = /^\[\s*카테고리\s*:\s*([a-z]+)\s*\]\s*$/i;

/** 노션에서 복사하면 토글 제목이 "03. 행복의 반의어" 처럼 번호를 달고 온다. */
const LEADING_NUMBER = /^\d{1,3}[.)]?\s+/;

export function parseDrafts(raw: string): ParsedDraft[] {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const chunks = text
    .split('\n')
    .reduce<string[][]>(
      (acc, line) => {
        if (SEPARATOR.test(line)) acc.push([]);
        else acc[acc.length - 1].push(line);
        return acc;
      },
      [[]],
    )
    .map((lines) => lines.join('\n').trim())
    .filter((chunk) => chunk !== '');

  return chunks.map(parseOne).filter((d) => d !== null);
}

function parseOne(chunk: string): ParsedDraft | null {
  const lines = chunk.split('\n');
  const warnings: string[] = [];

  let title = '';
  let deck = '';
  let category: PostCategory | null = null;
  const body: string[] = [];

  let seenTitle = false;

  for (const line of lines) {
    const cat = line.match(CATEGORY);
    if (cat && category === null) {
      const value = cat[1].toLowerCase();
      if (isCategory(value)) category = value;
      else warnings.push(`알 수 없는 카테고리 "${cat[1]}" — 화면에서 고르세요.`);
      continue;
    }

    if (!seenTitle) {
      const heading = line.match(HEADING);
      if (heading) {
        title = clean(heading[1]);
        seenTitle = true;
        continue;
      }
      // # 없이 시작하는 글. 첫 줄을 제목으로 올린다.
      if (line.trim() !== '') {
        title = clean(line);
        seenTitle = true;
        warnings.push('제목 줄에 # 이 없어 첫 줄을 제목으로 썼습니다.');
        continue;
      }
      continue;
    }

    // 제목 바로 다음의 인용 줄 하나만 부제로 본다. 본문 중간의 인용은 본문이다.
    if (!deck && body.every((b) => b.trim() === '')) {
      const d = line.match(DECK);
      if (d) {
        deck = clean(d[1]);
        continue;
      }
    }

    body.push(line);
  }

  const bodyText = body.join('\n').trim();
  if (!title && !bodyText) return null;

  if (!title) warnings.push('제목을 찾지 못했습니다.');
  if (!deck) warnings.push('부제가 없습니다. 카드 레이아웃이 부제를 전제로 합니다.');
  if (category === null) warnings.push('카테고리를 고르세요.');

  // 조각글 경고. 「산책자」 토글 절반이 한두 줄짜리 메모였다 — 그대로 발행되면
  // 홈 1면이 조각으로 찬다. 막지는 않고 눈에 띄게만 한다.
  if (bodyText.length < 200) {
    warnings.push(`본문이 ${bodyText.length}자입니다. 메모라면 초안으로 두세요.`);
  }

  return { title, deck, category, body: bodyText, warnings };
}

function clean(s: string): string {
  return s
    .replace(LEADING_NUMBER, '')
    // 노션에서 복사하면 따옴표가 곡선따옴표로 온다. 제목에서만 곧게 편다.
    .replace(/[“”]/g, '"')
    .trim();
}
