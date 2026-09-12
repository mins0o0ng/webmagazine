import 'server-only';
import { createHash } from 'node:crypto';
import { isCategory } from './categories';
import {
  blocksToMarkdown,
  coverUrl,
  fetchBlocks,
  notionEnabled,
  plainText,
  queryDatabase,
  selectName,
  urlValue,
  writeSyncNote,
  type NotionRow,
} from './notion';
import { adminClient } from './supabase';
import type { PostCategory, PostStatus, ThumbRatio } from './types';

/**
 * 노션 → Supabase 단방향 동기화 (M2-4).
 *
 * 원본은 노션이고 사이트는 사본이다. 반대 방향은 없다. 그래서 notion_page_id 가
 * 붙은 글은 /write 에서 편집을 막는다 — 열어두면 다음 동기화가 말없이 덮어쓴다.
 *
 * service_role 로 돈다. RLS 를 우회하므로 호출자가 반드시 게이트를 통과시켜야
 * 한다(편집장 세션이거나, cron 비밀값이거나).
 */

const BUCKET = 'post-images';
const RATIOS: ThumbRatio[] = ['3:2', '3:4', '1:1'];

/** 노션 "상태" → posts.status. '작성중' 은 아예 가져오지 않는다. */
const STATUS: Record<string, PostStatus | 'skip'> = {
  작성중: 'skip',
  초안: 'draft',
  발행: 'published',
  숨김: 'hidden',
};

export interface SyncOutcome {
  title: string;
  notionPageId: string;
  action: 'created' | 'updated' | 'unchanged' | 'skipped' | 'failed';
  status?: PostStatus;
  postId?: number;
  note: string;
}

export interface SyncReport {
  ran: boolean;
  error?: string;
  outcomes: SyncOutcome[];
}

/**
 * 이미지를 Supabase Storage 로 옮긴다.
 *
 * 왜 필요한가: 노션이 호스팅하는 이미지 URL 은 서명된 링크라 한 시간이면 만료된다.
 * 그대로 본문에 넣으면 동기화 직후에는 멀쩡하다가 한 시간 뒤 전부 깨진다.
 *
 * 파일 이름은 원본 URL 의 해시다. 같은 이미지를 다시 동기화해도 같은 자리에
 * 덮어써서 파일이 무한히 늘지 않는다. 서명 파라미터는 매번 바뀌므로 해시에서 뺀다.
 */
async function mirrorImage(url: string): Promise<string | null> {
  try {
    const stable = url.split('?')[0];
    const name = createHash('sha256').update(stable).digest('hex').slice(0, 32);

    const res = await fetch(url);
    if (!res.ok) return null;

    const type = res.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/')) return null;

    const ext = type.split('/')[1]?.split('+')[0]?.replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `notion/${name}.${ext}`;
    const body = new Uint8Array(await res.arrayBuffer());

    // 10MB 를 넘으면 지면에 쓸 사진이 아니다. 원본 URL 을 두느니 빼는 편이 낫다.
    if (body.byteLength > 10 * 1024 * 1024) return null;

    const db = adminClient();
    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, body, { contentType: type, upsert: true });
    if (error) throw error;

    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error('[notion] 이미지 복사 실패:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** 필자 핸들 → profiles.id. 비었거나 없는 핸들이면 기본 필자를 쓴다. */
async function resolveAuthor(handle: string, fallbackId: string): Promise<string> {
  if (!handle) return fallbackId;
  const { data } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();
  return (data?.id as string) ?? fallbackId;
}

async function syncRow(row: NotionRow, fallbackAuthorId: string): Promise<SyncOutcome> {
  const p = row.properties;
  const title = plainText(p['제목']);
  const base: Pick<SyncOutcome, 'title' | 'notionPageId'> = {
    title: title || '(제목 없음)',
    notionPageId: row.id,
  };

  const rawStatus = selectName(p['상태']) ?? '작성중';
  const mapped = STATUS[rawStatus] ?? 'skip';
  if (mapped === 'skip') {
    return { ...base, action: 'skipped', note: `상태가 "${rawStatus}" 라 건너뜀` };
  }

  if (!title) {
    return { ...base, action: 'failed', note: '제목이 비어 있습니다.' };
  }

  const notes: string[] = [];

  // 부제는 not null 이다(§3.2). 비어 있으면 발행까지 가지 않게 막는다 —
  // 자리표시자를 넣어 지면에 내보내면 카드 레이아웃이 무너진 채로 나간다.
  const deck = plainText(p['부제']);
  if (!deck && mapped === 'published') {
    return { ...base, action: 'failed', note: '부제가 비어 있어 발행할 수 없습니다.' };
  }

  const rawCategory = selectName(p['카테고리']);
  let category: PostCategory = 'essay';
  if (rawCategory && isCategory(rawCategory)) category = rawCategory;
  else if (mapped === 'published') {
    return { ...base, action: 'failed', note: '카테고리를 골라야 발행됩니다.' };
  } else notes.push('카테고리 없음 → essay');

  // 본문
  const blocks = await fetchBlocks(row.id);
  const rendered = blocksToMarkdown(blocks);
  let body = rendered.markdown;

  if (!body && mapped === 'published') {
    return { ...base, action: 'failed', note: '본문이 비어 있어 발행할 수 없습니다.' };
  }
  if (rendered.skipped.length > 0) {
    notes.push(`옮기지 못한 블록: ${rendered.skipped.join(', ')}`);
  }

  // 본문 이미지 → Storage
  for (const img of rendered.images) {
    const permanent = img.expiring ? await mirrorImage(img.url) : img.url;
    if (permanent) {
      body = body.replaceAll(img.token, permanent);
    } else {
      // 옮기지 못한 이미지는 지운다. 만료될 주소를 남기면 한 시간 뒤 깨진 그림이 된다.
      body = body.replace(new RegExp(`!\\[[^\\]]*\\]\\(${img.token}\\)\\n?`, 'g'), '');
      notes.push('이미지 하나를 옮기지 못해 본문에서 뺐습니다.');
    }
  }

  // 썸네일: 속성이 우선, 없으면 페이지 커버
  let thumbnail = urlValue(p['썸네일']);
  if (!thumbnail) {
    const cover = coverUrl(row.cover);
    if (cover) {
      thumbnail = cover.expiring ? await mirrorImage(cover.url) : cover.url;
      if (!thumbnail) notes.push('커버 이미지를 옮기지 못했습니다.');
    }
  }

  const rawRatio = selectName(p['썸네일 비율']);
  const ratio = rawRatio && RATIOS.includes(rawRatio as ThumbRatio) ? (rawRatio as ThumbRatio) : null;

  const authorId = await resolveAuthor(plainText(p['필자 핸들']), fallbackAuthorId);

  const payload = {
    author_id: authorId,
    title,
    deck: deck || '(부제를 아직 쓰지 않았습니다)',
    body: body || ' ',
    category,
    status: mapped,
    thumbnail_url: thumbnail,
    thumbnail_ratio: thumbnail ? ratio : null,
    notion_page_id: row.id,
    notion_synced_at: new Date().toISOString(),
  };

  const db = adminClient();
  const { data: existing } = await db
    .from('posts')
    .select('id, title, deck, body, category, status, thumbnail_url')
    .eq('notion_page_id', row.id)
    .maybeSingle();

  if (existing) {
    // 내용이 그대로면 쓰지 않는다. 매번 UPDATE 하면 updated_at 이 밀리고
    // revalidatePath 가 캐시를 헛되이 비운다.
    const same =
      existing.title === payload.title &&
      existing.deck === payload.deck &&
      existing.body === payload.body &&
      existing.category === payload.category &&
      existing.status === payload.status &&
      (existing.thumbnail_url ?? null) === payload.thumbnail_url;

    if (same) {
      await db
        .from('posts')
        .update({ notion_synced_at: payload.notion_synced_at })
        .eq('id', existing.id);
      return {
        ...base,
        action: 'unchanged',
        status: mapped,
        postId: existing.id as number,
        note: '바뀐 것 없음',
      };
    }

    const { error } = await db.from('posts').update(payload).eq('id', existing.id);
    if (error) return { ...base, action: 'failed', note: error.message };

    return {
      ...base,
      action: 'updated',
      status: mapped,
      postId: existing.id as number,
      note: notes.join(' / ') || '갱신',
    };
  }

  const { data: created, error } = await db.from('posts').insert(payload).select('id').single();
  if (error) return { ...base, action: 'failed', note: error.message };

  return {
    ...base,
    action: 'created',
    status: mapped,
    postId: created.id as number,
    note: notes.join(' / ') || '새로 들어옴',
  };
}

/**
 * 전체 동기화.
 *
 * fallbackAuthorId 는 노션 행에 "필자 핸들" 이 비어 있을 때 쓸 필자다.
 * 사람이 눌렀으면 그 편집장, cron 이면 첫 편집장.
 */
export async function syncFromNotion(fallbackAuthorId: string): Promise<SyncReport> {
  if (!notionEnabled()) {
    return { ran: false, error: '노션이 설정돼 있지 않습니다.', outcomes: [] };
  }

  let rows: NotionRow[];
  try {
    rows = await queryDatabase();
  } catch (err) {
    return {
      ran: false,
      error: err instanceof Error ? err.message : '노션을 읽지 못했습니다.',
      outcomes: [],
    };
  }

  const outcomes: SyncOutcome[] = [];
  const touched = new Set<string>();

  for (const row of rows) {
    let outcome: SyncOutcome;
    try {
      outcome = await syncRow(row, fallbackAuthorId);
    } catch (err) {
      outcome = {
        title: plainText(row.properties['제목']) || '(제목 없음)',
        notionPageId: row.id,
        action: 'failed',
        note: err instanceof Error ? err.message : '알 수 없는 오류',
      };
    }
    outcomes.push(outcome);
    if (outcome.action !== 'skipped') touched.add(outcome.notionPageId);

    // 결과를 노션에 되돌려 적는다. 사이트를 열어봐야만 반영 여부를 알 수 있으면
    // 자동 동기화의 의미가 절반이다. 실패해도 동기화 자체는 계속한다.
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const label =
      outcome.action === 'failed'
        ? `⚠ ${outcome.note}`
        : outcome.action === 'skipped'
          ? outcome.note
          : `${stamp} ${outcome.action === 'unchanged' ? '확인' : '반영'} — ${outcome.note}`;
    await writeSyncNote(row.id, label).catch(() => {});
  }

  /* 노션에서 지운 행은 사이트에서도 내린다 — 삭제가 아니라 숨김이다.
   * 원본이 사라졌다고 좋아요와 댓글까지 cascade 로 지우면 되돌릴 수 없다.
   *
   * 한 행도 못 읽었으면 이 청소를 하지 않는다. "노션이 비었다" 와 "노션을 못 읽었다"
   * 는 여기서 구분되지 않는데, 후자가 훨씬 흔하다 — 통합 연결이 끊기거나,
   * NOTION_DATABASE_ID 가 엉뚱한 DB 를 가리키거나, 권한이 바뀌면 질의는 성공하고
   * 결과만 0행으로 온다. 그대로 두면 설정 실수 한 번에 지면 전체가 내려간다.
   * 진짜로 원고를 다 지웠다면 편집실에서 내리는 편이 맞다. */
  if (rows.length === 0) {
    return {
      ran: true,
      error:
        '노션에서 한 행도 읽지 못했습니다. 통합 연결과 NOTION_DATABASE_ID 를 확인하세요. ' +
        '지면에 있는 글은 건드리지 않았습니다.',
      outcomes,
    };
  }

  const db = adminClient();
  const { data: orphans } = await db
    .from('posts')
    .select('id, title, notion_page_id')
    .not('notion_page_id', 'is', null)
    .neq('status', 'hidden');

  for (const orphan of (orphans ?? []) as { id: number; title: string; notion_page_id: string }[]) {
    if (touched.has(orphan.notion_page_id)) continue;
    await db.from('posts').update({ status: 'hidden' }).eq('id', orphan.id);
    outcomes.push({
      title: orphan.title,
      notionPageId: orphan.notion_page_id,
      action: 'updated',
      status: 'hidden',
      postId: orphan.id,
      note: '노션에서 사라져 숨김 처리 (삭제하지 않음)',
    });
  }

  return { ran: true, outcomes };
}
