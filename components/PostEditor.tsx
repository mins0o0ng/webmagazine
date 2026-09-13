'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { savePost, type ActionState } from '@/app/write/actions';
import { CATEGORIES } from '@/lib/categories';
import type { PostDetail } from '@/lib/types';
import { Markdown } from './Markdown';
import { MarkdownToolbar, type Edit } from './MarkdownToolbar';
import { useAutosave, type Snapshot } from './useAutosave';
import styles from './PostEditor.module.css';

interface Props {
  /** 수정 모드일 때의 기존 글. 새 글이면 undefined. */
  post?: PostDetail;
}

/**
 * 폼에서 자동저장에 보낼 값만 뽑는다. 허용 목록이라 status 는 들어오지 않는다 —
 * 자동저장은 언제나 초안이고, 발행 여부는 사람이 버튼을 눌러야 정해진다.
 */
function snapshotOf(form: HTMLFormElement): Snapshot {
  const data = new FormData(form);
  const out: Snapshot = {};
  for (const key of ['title', 'deck', 'category', 'thumbnail_url', 'thumbnail_ratio', 'body']) {
    out[key] = String(data.get(key) ?? '');
  }
  return out;
}

export function PostEditor({ post }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(savePost, {});
  const [body, setBody] = useState(post?.body ?? '');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [thumbnailUrl, setThumbnailUrl] = useState(post?.thumbnail_url ?? '');

  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  /** 눌린 버튼이 발행인지 임시저장인지. 아래 hidden 칸이 서버로 나른다. */
  const statusRef = useRef<HTMLInputElement>(null);
  /** 툴바가 잡아 둔 커서. 본문이 렌더된 뒤에 적용한다. */
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  const isPublished = post?.status === 'published';

  // postId 를 받는 것이 중요하다. 자동저장이 초안을 새로 만들면 그 id 는 여기로만
  // 돌아온다 — 페이지는 여전히 "새 글" 이라 post 는 계속 undefined 다.
  // 이걸 폼에 심지 않으면 발행이 그 초안을 발행하는 대신 새 행을 하나 더 만든다.
  const {
    postId,
    state: saveState,
    recovered,
    onChange,
    commit,
    dismissRecovered,
  } = useAutosave({
    initialId: post?.id ?? null,
    baseline: {
      title: post?.title ?? '',
      deck: post?.deck ?? '',
      category: post?.category ?? '',
      thumbnail_url: post?.thumbnail_url ?? '',
      thumbnail_ratio: post?.thumbnail_ratio ?? '3:2',
      body: post?.body ?? '',
    },
    // 발행된 글은 서버 자동저장을 하지 않는다. 지면에 나가 있는 글을 사람이
    // 저장을 누르지도 않았는데 덮어쓰면 안 된다(actions.ts autosaveDraft 주석).
    serverAutosave: !isPublished,
  });

  const handleInput = useCallback(() => {
    if (formRef.current) onChange(snapshotOf(formRef.current));
  }, [onChange]);

  /** 버튼을 누른 순간 상태를 정하고, 자동저장의 대기 중인 타이머를 정리한다. */
  const submitAs = useCallback(
    (status: 'draft' | 'published') => {
      if (statusRef.current) statusRef.current.value = status;
      commit();
    },
    [commit],
  );

  // 툴바가 본문을 고친 뒤 커서를 되돌린다. React 가 value 를 반영한 다음이어야 한다.
  useEffect(() => {
    const sel = pendingSelection.current;
    if (!sel || !bodyRef.current) return;
    pendingSelection.current = null;
    bodyRef.current.focus();
    bodyRef.current.setSelectionRange(sel.start, sel.end);
  }, [body]);

  function applyEdit(edit: Edit) {
    pendingSelection.current = { start: edit.start, end: edit.end };
    setBody(edit.value);
    // setBody 는 비동기라 폼에서 바로 읽으면 이전 값이 나온다. 스냅샷을 직접 만든다.
    if (formRef.current) {
      onChange({ ...snapshotOf(formRef.current), body: edit.value });
    }
  }

  /** 브라우저에 남아 있던 초안을 폼에 되돌린다. */
  function restore() {
    const form = formRef.current;
    if (!form || !recovered) return;

    for (const [key, value] of Object.entries(recovered)) {
      if (key === 'body') continue;
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        field.value = value;
      }
    }
    // 이 둘만 React 가 값을 쥐고 있다.
    setThumbnailUrl(recovered.thumbnail_url ?? '');
    setBody(recovered.body ?? '');
    dismissRecovered();
  }

  return (
    <div className={`page ${styles.wrap}`}>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>{post ? '글 수정' : '새 글'}</h1>
        <SaveIndicator state={saveState} enabled={!isPublished} />
      </div>

      {recovered && (
        <div className={styles.recover} role="alert">
          <div>
            <strong className={styles.recoverTitle}>저장되지 않은 내용이 있습니다.</strong>
            <p className={styles.recoverBody}>
              브라우저에 남아 있던 초안입니다. 마지막으로 이 화면을 떠날 때의 내용이에요.
            </p>
          </div>
          <div className={styles.recoverActions}>
            <button type="button" className={styles.recoverPrimary} onClick={restore}>
              복구
            </button>
            <button type="button" className={styles.recoverGhost} onClick={dismissRecovered}>
              버리기
            </button>
          </div>
        </div>
      )}

      <form ref={formRef} action={formAction} onInput={handleInput} className={styles.form}>
        {/* post?.id 가 아니라 postId 다. 자동저장이 방금 만든 초안의 id 까지 포함한다. */}
        {postId !== null && <input type="hidden" name="id" value={postId} />}

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="title">
            제목
          </label>
          <input
            id="title"
            name="title"
            className={styles.input}
            defaultValue={post?.title}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="deck">
            부제{' '}
            <span className={styles.hint}>
              필수. 썸네일이 없는 카드에서는 이 문장이 표지 역할을 합니다.
            </span>
          </label>
          <input
            id="deck"
            name="deck"
            className={styles.input}
            defaultValue={post?.deck}
            required
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="category">
              카테고리
            </label>
            <select
              id="category"
              name="category"
              className={styles.select}
              defaultValue={post?.category ?? ''}
              onChange={handleInput}
              required
            >
              <option value="" disabled>
                선택하세요
              </option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="thumbnail_ratio">
              썸네일 비율
            </label>
            <select
              id="thumbnail_ratio"
              name="thumbnail_ratio"
              className={styles.select}
              defaultValue={post?.thumbnail_ratio ?? '3:2'}
              onChange={handleInput}
              disabled={!thumbnailUrl}
            >
              <option value="3:2">3:2 가로</option>
              <option value="3:4">3:4 세로</option>
              <option value="1:1">1:1 정사각</option>
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="thumbnail_url">
            썸네일 URL{' '}
            <span className={styles.hint}>
              비워도 됩니다. 없으면 부제를 활자로 세운 카드가 나갑니다.
            </span>
          </label>
          {/* 업로드는 아직 없다(§8 미결정). 그때까지는 외부 URL 을 직접 넣는다. */}
          <input
            id="thumbnail_url"
            name="thumbnail_url"
            type="url"
            className={styles.input}
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.editorHead}>
            <span className={styles.label}>본문 (마크다운)</span>
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'write'}
                className={`${styles.tab} ${tab === 'write' ? styles.tabActive : ''}`}
                onClick={() => setTab('write')}
              >
                작성
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'preview'}
                className={`${styles.tab} ${tab === 'preview' ? styles.tabActive : ''}`}
                onClick={() => setTab('preview')}
              >
                미리보기
              </button>
            </div>
          </div>

          {tab === 'write' && <MarkdownToolbar textarea={() => bodyRef.current} onEdit={applyEdit} />}

          {/* 미리보기로 넘어가도 textarea 를 언마운트하지 않는다.
              언마운트하면 폼 제출에서 body 가 통째로 빠진다. */}
          <textarea
            id="body"
            name="body"
            ref={bodyRef}
            className={`${styles.textarea} ${tab === 'write' ? styles.textareaWithBar : ''}`}
            hidden={tab !== 'write'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />

          {tab === 'preview' && (
            <div className={styles.preview}>
              {body.trim() ? (
                <Markdown>{body}</Markdown>
              ) : (
                <p className={styles.previewEmpty}>본문을 입력하면 여기에 보입니다.</p>
              )}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {/* 어느 버튼을 눌렀는지는 이 칸이 나른다. 제출 버튼의 name/value 에
              기대지 않는다 — 그 값이 FormData 에 실리지 않아 발행이 전부 초안으로
              저장되는 일이 실제로 있었다. onClick 은 submit 보다 먼저 도므로
              여기 적힌 값이 그대로 서버에 간다. */}
          <input type="hidden" name="status" ref={statusRef} defaultValue="draft" />

          <SubmitButton variant="primary" onSubmit={() => submitAs('published')}>
            발행
          </SubmitButton>
          <SubmitButton variant="secondary" onSubmit={() => submitAs('draft')}>
            임시저장
          </SubmitButton>
          {isPublished && (
            <span className={styles.actionsNote}>
              발행된 글은 자동저장하지 않습니다. 바꾼 내용은 발행을 눌러야 지면에 나갑니다.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------- */

function SaveIndicator({ state, enabled }: { state: ReturnType<typeof useAutosave>['state']; enabled: boolean }) {
  if (!enabled) return <span className={styles.saveState}>자동저장 꺼짐 (발행글)</span>;

  switch (state.kind) {
    case 'saving':
      return <span className={styles.saveState}>저장 중…</span>;
    case 'saved':
      return (
        <span className={styles.saveState}>
          {new Date(state.at).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          에 저장됨
        </span>
      );
    case 'error':
      return <span className={styles.saveStateError}>{state.message}</span>;
    default:
      return <span className={styles.saveState}>자동저장 켜짐</span>;
  }
}

/**
 * name/value 를 받지 않는다. 어느 버튼을 눌렀는지는 폼의 hidden status 칸이
 * 나른다 — 제출 버튼의 name/value 는 FormData 에 실리지 않는 경우가 있었고,
 * 그 결과 발행이 전부 초안으로 저장됐다.
 */
function SubmitButton({
  variant,
  onSubmit,
  children,
}: {
  variant: 'primary' | 'secondary';
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={styles[variant]}
      onClick={onSubmit}
      disabled={pending}
    >
      {children}
    </button>
  );
}
