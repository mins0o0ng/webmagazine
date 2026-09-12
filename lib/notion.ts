import 'server-only';

/**
 * 노션 REST 클라이언트 (M2-4).
 *
 * 공식 SDK 대신 fetch 를 쓴다. 쓰는 엔드포인트가 셋뿐이고(데이터베이스 질의,
 * 블록 자식 읽기, 페이지 속성 쓰기), 어차피 블록 → 마크다운 변환은 직접
 * 만들어야 하기 때문이다. 의존성 하나를 아낀다.
 *
 * API 버전은 2022-06-28 에 고정한다. 노션이 새 버전에서 데이터 소스 개념을
 * 도입했지만, 데이터 소스가 하나인 데이터베이스는 옛 버전의
 * /v1/databases/{id}/query 로 그대로 읽힌다. 버전을 고정해 두지 않으면
 * 노션이 기본값을 올리는 날 조용히 깨진다.
 */

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

export function notionToken(): string | null {
  const raw = process.env.NOTION_TOKEN?.trim();
  return raw ? raw : null;
}

export function notionDatabaseId(): string | null {
  const raw = process.env.NOTION_DATABASE_ID?.trim();
  return raw ? raw : null;
}

/** 노션이 설정돼 있는가. 둘 중 하나라도 없으면 동기화 기능 전체가 없는 것으로 친다. */
export function notionEnabled(): boolean {
  return notionToken() !== null && notionDatabaseId() !== null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = notionToken();
  if (!token) throw new Error('NOTION_TOKEN 이 없습니다.');

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'notion-version': VERSION,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    // 노션 응답은 절대 캐시하지 않는다. 동기화는 늘 지금 상태를 봐야 한다.
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 가장 흔한 실패 둘은 원인이 분명하므로 사람이 읽을 수 있는 말로 바꾼다.
    if (res.status === 401) {
      throw new Error('노션 토큰이 거부됐습니다. NOTION_TOKEN 을 확인하세요.');
    }
    if (res.status === 404) {
      throw new Error(
        '노션이 그 데이터베이스를 찾지 못했습니다. 통합(integration)에 데이터베이스를 ' +
          '연결했는지 확인하세요 — 노션에서 페이지 우상단 ⋯ → 연결 → 통합 선택.',
      );
    }
    throw new Error(`노션 API ${res.status}: ${body.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

/* --- 타입 — 우리가 실제로 읽는 만큼만 --------------------------------- */

interface RichText {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    code: boolean;
  };
}

interface FileValue {
  type: 'file' | 'external';
  file?: { url: string };
  external?: { url: string };
}

export interface NotionRow {
  id: string;
  last_edited_time: string;
  cover: FileValue | null;
  properties: Record<string, NotionProperty>;
}

/**
 * 속성은 종류마다 모양이 다르다. 판별 유니온으로 쓰면 우리가 안 읽는 종류까지
 * 전부 적어야 하므로, 느슨하게 두고 아래 접근자에서 한 번씩 좁힌다.
 */
export interface NotionProperty {
  type: string;
  [k: string]: unknown;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [k: string]: unknown;
}

/* --- 읽기 -------------------------------------------------------------- */

/** 데이터베이스의 모든 행. 100건씩 끊어 받는다. */
export async function queryDatabase(): Promise<NotionRow[]> {
  const id = notionDatabaseId();
  if (!id) throw new Error('NOTION_DATABASE_ID 가 없습니다.');

  const rows: NotionRow[] = [];
  let cursor: string | undefined;

  do {
    const page = await call<{
      results: NotionRow[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/databases/${id}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });

    rows.push(...page.results);
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;

    // 원고가 수천 편이 될 일은 없다. 무한 루프를 막되, 조용히 끊지는 않는다 —
    // 목록이 잘린 채로 돌아가면 동기화가 그 뒤의 글을 "노션에서 사라졌다" 고 보고
    // 전부 숨겨 버린다. 여기서 던지면 부분 목록이 밖으로 나가지 않는다.
    if (rows.length > 2000) {
      throw new Error(
        `원고가 2000행을 넘습니다 (${rows.length}행에서 중단). ` +
          '목록이 잘린 채로 동기화하면 나머지 글이 전부 숨김 처리되므로 멈춥니다.',
      );
    }
  } while (cursor);

  return rows;
}

/** 블록의 자식 전부. 중첩은 두 단계까지만 따라간다(목록 안의 목록 정도). */
export async function fetchBlocks(blockId: string, depth = 0): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);

    const page = await call<{
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/blocks/${blockId}/children?${params}`);

    for (const block of page.results) {
      out.push(block);
      // 토글·인용 안에 문단이 들어 있는 경우가 흔하다. 그것까지는 가져온다.
      if (block.has_children && depth < 2) {
        const children = await fetchBlocks(block.id, depth + 1);
        (block as { __children?: NotionBlock[] }).__children = children;
      }
    }

    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return out;
}

/* --- 쓰기 -------------------------------------------------------------- */

/**
 * 동기화 결과를 노션 쪽 "동기화" 속성에 적는다.
 *
 * 노션에서 결과를 볼 수 있어야 한다. 사이트를 열어봐야만 반영 여부를 알 수 있으면
 * 자동 동기화의 의미가 절반이다.
 */
export async function writeSyncNote(pageId: string, note: string): Promise<void> {
  await call(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        동기화: { rich_text: [{ type: 'text', text: { content: note.slice(0, 2000) } }] },
      },
    }),
  });
}

/* --- 속성 읽기 --------------------------------------------------------- */

export function plainText(prop: NotionProperty | undefined): string {
  if (!prop) return '';
  const items = (prop.type === 'title' ? prop.title : prop.rich_text) as RichText[] | undefined;
  if (!Array.isArray(items)) return '';
  return items.map((t) => t.plain_text).join('').trim();
}

export function selectName(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== 'select') return null;
  const value = prop.select as { name?: string } | null | undefined;
  return value?.name ?? null;
}

export function urlValue(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== 'url') return null;
  const v = typeof prop.url === 'string' ? prop.url.trim() : '';
  return v ? v : null;
}

/** 페이지 커버. 노션이 호스팅하는 파일이면 만료되므로 그 사실을 함께 돌려준다. */
export function coverUrl(cover: FileValue | null): { url: string; expiring: boolean } | null {
  if (!cover) return null;
  if (cover.type === 'external' && cover.external?.url) {
    return { url: cover.external.url, expiring: false };
  }
  if (cover.type === 'file' && cover.file?.url) {
    return { url: cover.file.url, expiring: true };
  }
  return null;
}

/* --- 블록 → 마크다운 ---------------------------------------------------- */

function renderRich(items: RichText[] | undefined): string {
  if (!items) return '';
  return items
    .map((t) => {
      let s = t.plain_text;
      if (!s) return '';
      const a = t.annotations;
      // 코드가 가장 안쪽이다. 코드 안의 별표는 강조가 아니라 글자다.
      if (a.code) s = `\`${s}\``;
      if (a.bold) s = `**${s}**`;
      if (a.italic) s = `*${s}*`;
      if (a.strikethrough) s = `~~${s}~~`;
      if (t.href) s = `[${s}](${t.href})`;
      return s;
    })
    .join('');
}

/** 본문에 남은 이미지. 만료되는 것은 나중에 Storage 로 옮긴다. */
export interface FoundImage {
  url: string;
  expiring: boolean;
  /** 본문에서 이 자리를 표시하는 토큰. 옮긴 뒤 실제 주소로 치환한다. */
  token: string;
}

export interface Rendered {
  markdown: string;
  images: FoundImage[];
  /** 마크다운에 대응물이 없어 버린 블록 종류. 사람에게 알린다. */
  skipped: string[];
}

export function blocksToMarkdown(blocks: NotionBlock[]): Rendered {
  const images: FoundImage[] = [];
  const skipped = new Set<string>();
  const lines: string[] = [];

  const LIST = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do']);

  function walk(list: NotionBlock[], indent = '') {
    for (const [i, block] of list.entries()) {
      const b = block as Record<string, { rich_text?: RichText[] } | undefined> &
        NotionBlock & { __children?: NotionBlock[] };
      const data = b[block.type] as
        | { rich_text?: RichText[]; caption?: RichText[]; language?: string }
        | undefined;
      const text = renderRich(data?.rich_text);

      switch (block.type) {
        case 'paragraph':
          lines.push(indent + text, '');
          break;
        // 지면의 표제는 h1 이므로 본문은 h2 부터 시작한다(app/p/[id] 참고).
        case 'heading_1':
          lines.push(`${indent}## ${text}`, '');
          break;
        case 'heading_2':
          lines.push(`${indent}### ${text}`, '');
          break;
        case 'heading_3':
          lines.push(`${indent}#### ${text}`, '');
          break;
        case 'bulleted_list_item':
          lines.push(`${indent}- ${text}`);
          break;
        case 'numbered_list_item':
          lines.push(`${indent}1. ${text}`);
          break;
        case 'to_do':
          lines.push(`${indent}- ${text}`);
          break;
        case 'quote':
          lines.push(`${indent}> ${text}`, '');
          break;
        // 콜아웃은 마크다운에 대응물이 없다. 인용으로 눕히는 편이 버리는 것보다 낫다.
        case 'callout':
          lines.push(`${indent}> ${text}`, '');
          break;
        case 'code':
          lines.push(`${indent}\`\`\`${data?.language ?? ''}`, text, `${indent}\`\`\``, '');
          break;
        case 'divider':
          lines.push(`${indent}---`, '');
          break;
        case 'image': {
          const file = block[block.type] as FileValue & { caption?: RichText[] };
          const found = coverUrl(file);
          if (found) {
            const token = `__WM_IMG_${images.length}__`;
            images.push({ ...found, token });
            const alt = renderRich(file.caption).replace(/[[\]]/g, '');
            lines.push(`${indent}![${alt}](${token})`, '');
          }
          break;
        }
        // 토글은 접히는 UI 라 마크다운에 없다. 제목을 굵게 세우고 안쪽을 펼친다.
        case 'toggle':
          if (text) lines.push(`${indent}**${text}**`, '');
          break;
        case 'child_page':
        case 'child_database':
        case 'table':
        case 'column_list':
        case 'synced_block':
        case 'embed':
        case 'bookmark':
        case 'video':
        case 'file':
          skipped.add(block.type);
          break;
        default:
          if (text) lines.push(indent + text, '');
          else skipped.add(block.type);
      }

      const children = (block as { __children?: NotionBlock[] }).__children;
      if (children?.length) {
        const nested = LIST.has(block.type);
        walk(children, nested ? `${indent}  ` : indent);
        if (!nested) lines.push('');
      }

      // 목록이 끝나면 빈 줄을 하나 넣는다. 없으면 바로 뒤의 인용이나 다른 종류의
      // 목록이 앞 목록의 이어짐(lazy continuation)으로 먹혀 통째로 잘못 렌더된다.
      const next = list[i + 1];
      if (LIST.has(block.type) && next?.type !== block.type) lines.push('');
    }
  }

  walk(blocks);

  const markdown = lines
    .join('\n')
    // 빈 줄이 셋 이상 이어지면 두 줄로 줄인다. 노션의 빈 블록이 그대로 넘어온다.
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { markdown, images, skipped: [...skipped] };
}
