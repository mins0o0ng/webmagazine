/**
 * 일시적인 실패는 한 번 더 시도한다.
 *
 * 왜 필요한가. 홈·카테고리 다섯 개·feed.xml 은 빌드 시점에 미리 렌더되고,
 * 그 렌더가 전부 Supabase 를 읽는다. 그중 하나가 늦으면 배포 전체가 죽는다.
 * 실제로 `Gateway Timeout` 하나 때문에 배포가 막혔고, 코드에는 아무 잘못이
 * 없었는데 원인을 찾는 데 오래 걸렸다.
 *
 * 재시도로 감출 수 있는 것과 없는 것을 구분한다. 타임아웃·연결 끊김 같은
 * 일시적 실패만 다시 시도하고, 권한 오류나 컬럼 없음처럼 다시 해도 같은
 * 답이 나올 실패는 즉시 던진다 — 그런 것을 세 번 시도하면 배포가 느려질 뿐
 * 결과는 같고, 진짜 원인만 늦게 드러난다.
 */

/** 다시 시도할 만한 실패인가. 메시지로만 판단할 수 있는 것들이다. */
const TRANSIENT =
  /gateway timeout|timed? ?out|fetch failed|socket hang up|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|502|503|504/i;

const DELAYS_MS = [300, 900];

export interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Supabase 질의를 실행하고, 일시적 실패면 다시 시도한다.
 *
 * build 를 함수로 받는 이유: PostgrestBuilder 는 한 번 await 하면 재사용할 수
 * 없다. 매 시도마다 새로 만들어야 한다.
 *
 * @param what 실패했을 때 사람에게 보일 말. "글 목록을 불러오지 못했습니다" 처럼.
 */
export async function runQuery<T>(
  what: string,
  build: () => PromiseLike<QueryResult<T>>,
): Promise<T | null> {
  let lastMessage = '';

  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt - 1]));
    }

    const { data, error } = await build();
    if (!error) return data;

    lastMessage = error.message;
    if (!TRANSIENT.test(error.message)) break;
  }

  throw new Error(`${what}: ${lastMessage}`);
}
