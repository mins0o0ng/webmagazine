'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { autosaveDraft } from '@/app/write/actions';

/** 폼 한 벌을 그대로 담는다. 필드가 늘어도 이 타입은 그대로다. */
export type Snapshot = Record<string, string>;

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const LOCAL_PREFIX = 'wm:draft:';
const LOCAL_DEBOUNCE = 600;
const SERVER_DEBOUNCE = 3000;

function localKey(postId: number | null) {
  return `${LOCAL_PREFIX}${postId ?? 'new'}`;
}

function sameSnapshot(a: Snapshot, b: Snapshot) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? '') !== (b[k] ?? '')) return false;
  return true;
}

interface Options {
  /** 기존 글의 id. 새 글이면 null. */
  initialId: number | null;
  /** 서버에 저장된 값. 브라우저 초안과 비교해 복구를 제안할 기준이 된다. */
  baseline: Snapshot;
  /**
   * 서버 자동저장을 켤지. 발행된 글에서는 꺼야 한다 — 지면에 나가 있는 글을
   * 사람이 저장을 누르지도 않았는데 덮어쓰면 안 된다. 그 경우에도 브라우저
   * 초안 복구는 그대로 돈다.
   */
  serverAutosave: boolean;
}

/**
 * 초안 자동저장·복구 (M2-2).
 *
 * 두 겹이다.
 *
 *   브라우저 (항상)  — 0.6초마다 localStorage 에 적는다. 탭이 죽든 네트워크가
 *                      끊기든 남는다. 발행글 수정 중에도 이쪽은 돈다.
 *   서버 (초안만)    — 3초 멈추면 posts 에 쓴다. 다른 기기에서 이어 쓸 수 있고,
 *                      브라우저 저장소를 지워도 남는다.
 *
 * 서버 저장은 revalidatePath 를 부르지 않는다(actions.ts 참고). 초안은 어느
 * 캐시된 지면에도 나가지 않고, 몇 초마다 홈 캐시를 비우면 자동저장이 곧
 * 사이트 성능 문제가 된다.
 */
export function useAutosave({ initialId, baseline, serverAutosave }: Options) {
  const [postId, setPostId] = useState<number | null>(initialId);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  /** 브라우저에 남아 있던 초안. 서버 값과 다를 때만 채워진다. */
  const [recovered, setRecovered] = useState<Snapshot | null>(null);

  const baselineRef = useRef(baseline);
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<Snapshot>(baseline);
  const inFlight = useRef(false);

  // 마운트 시 한 번. 브라우저에 남은 초안이 서버 값과 다르면 복구를 제안한다.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(localKey(initialId));
      if (!raw) return;
      const stored = JSON.parse(raw) as Snapshot;
      if (!sameSnapshot(stored, baselineRef.current)) setRecovered(stored);
    } catch {
      // 시크릿 모드나 저장소 차단. 자동저장이 없을 뿐 글쓰기는 그대로 된다.
    }
  }, [initialId]);

  const clearLocal = useCallback((id: number | null) => {
    try {
      window.localStorage.removeItem(localKey(id));
    } catch {
      /* 위와 같음 */
    }
  }, []);

  /** 폼이 바뀔 때마다 부른다. 두 타이머를 다시 건다. */
  const onChange = useCallback(
    (snapshot: Snapshot) => {
      if (localTimer.current) clearTimeout(localTimer.current);
      localTimer.current = setTimeout(() => {
        try {
          window.localStorage.setItem(localKey(postId), JSON.stringify(snapshot));
        } catch {
          /* 저장소가 막혀 있으면 서버 자동저장만 남는다 */
        }
      }, LOCAL_DEBOUNCE);

      if (!serverAutosave) return;

      if (serverTimer.current) clearTimeout(serverTimer.current);
      serverTimer.current = setTimeout(async () => {
        // 앞선 저장이 아직 돌고 있으면 건너뛴다. 다음 타자가 어차피 최신값을 보낸다.
        if (inFlight.current) return;
        if (sameSnapshot(snapshot, lastSaved.current)) return;
        if (!snapshot.title?.trim()) return;

        inFlight.current = true;
        setState({ kind: 'saving' });

        const form = new FormData();
        for (const [k, v] of Object.entries(snapshot)) form.append(k, v);
        if (postId !== null) form.set('id', String(postId));

        try {
          const result = await autosaveDraft(form);
          if (result.error) {
            setState({ kind: 'error', message: result.error });
          } else if (result.skipped) {
            setState({ kind: 'idle' });
          } else {
            lastSaved.current = snapshot;
            if (result.id !== undefined && result.id !== postId) {
              setPostId(result.id);
              // 새 글이 방금 초안이 됐다. 주소를 바꿔 두면 새로고침해도 이어진다.
              // 이동이 아니라 주소만 바꾸는 것이라 폼 상태는 그대로 있다.
              window.history.replaceState(null, '', `/write/${result.id}`);
              clearLocal(null);
            }
            setState({ kind: 'saved', at: result.savedAt ?? Date.now() });
          }
        } catch {
          // 네트워크가 끊겼다. localStorage 에는 이미 있으므로 글은 안전하다.
          setState({ kind: 'error', message: '연결이 끊겼습니다. 브라우저에는 저장돼 있습니다.' });
        } finally {
          inFlight.current = false;
        }
      }, SERVER_DEBOUNCE);
    },
    [postId, serverAutosave, clearLocal],
  );

  /** 사람이 저장을 눌러 폼이 서버로 갔다. 브라우저 초안은 더 볼 이유가 없다. */
  const commit = useCallback(() => {
    if (localTimer.current) clearTimeout(localTimer.current);
    if (serverTimer.current) clearTimeout(serverTimer.current);
    clearLocal(postId);
    clearLocal(null);
  }, [postId, clearLocal]);

  const dismissRecovered = useCallback(() => {
    setRecovered(null);
    clearLocal(postId);
  }, [postId, clearLocal]);

  useEffect(
    () => () => {
      if (localTimer.current) clearTimeout(localTimer.current);
      if (serverTimer.current) clearTimeout(serverTimer.current);
    },
    [],
  );

  return { postId, state, recovered, onChange, commit, dismissRecovered };
}
