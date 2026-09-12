import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { notionEnabled } from '@/lib/notion';
import { syncFromNotion } from '@/lib/notionSync';
import { adminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
// 원고가 수십 편이면 블록 읽기와 이미지 복사에 시간이 걸린다.
export const maxDuration = 300;

/**
 * 노션 동기화 — 자동 실행 경로 (M2-4).
 *
 * Vercel Cron 이 vercel.json 의 일정대로 이 주소를 부른다. 사람이 누르는 경로는
 * /editor 의 버튼이고, 그쪽은 서버 액션이라 HTTP 를 타지 않는다.
 *
 * 인증: CRON_SECRET.
 *
 *   Vercel Cron 은 CRON_SECRET 이 설정돼 있으면 Authorization: Bearer <값> 을
 *   붙여 호출한다. 그 값이 없으면 이 경로는 아예 닫는다 — 열어두면 누구나
 *   반복 호출해 노션 API 한도를 태우고 Storage 를 채울 수 있다.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET 이 없어 자동 동기화 경로가 닫혀 있습니다.' },
      { status: 503 },
    );
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
  }

  if (!notionEnabled()) {
    return NextResponse.json({ error: '노션이 설정돼 있지 않습니다.' }, { status: 503 });
  }

  // cron 에는 사람이 없다. "필자 핸들" 이 빈 행은 가장 먼저 만들어진 편집장 앞으로 간다.
  const { data: editor } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!editor) {
    return NextResponse.json(
      { error: '편집장 계정이 없습니다. npm run db:admin 을 먼저 돌리세요.' },
      { status: 503 },
    );
  }

  const report = await syncFromNotion(editor.id as string);
  if (!report.ran) {
    return NextResponse.json({ error: report.error }, { status: 502 });
  }

  const changed = report.outcomes.filter(
    (o) => o.action === 'created' || o.action === 'updated',
  );

  // 바뀐 게 없으면 캐시를 건드리지 않는다. 10분마다 홈을 비우면
  // 자동 동기화가 곧 사이트 성능 문제가 된다.
  if (changed.length > 0) {
    revalidatePath('/');
    revalidatePath('/feed.xml');
    for (const o of changed) {
      if (o.postId !== undefined) revalidatePath(`/p/${o.postId}`);
    }
    // 어느 카테고리가 바뀌었는지 추적하는 것보다 다섯 개를 다 비우는 편이 싸다.
    for (const slug of ['essay', 'place', 'love', 'life', 'pick']) {
      revalidatePath(`/category/${slug}`);
    }
  }

  return NextResponse.json({
    ok: true,
    changed: changed.length,
    total: report.outcomes.length,
    outcomes: report.outcomes,
  });
}

/** Vercel Cron 은 GET 으로 부른다. 같은 처리를 태운다. */
export async function GET(request: NextRequest) {
  return POST(request);
}
