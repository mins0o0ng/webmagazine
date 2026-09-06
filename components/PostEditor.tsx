'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { savePost, type ActionState } from '@/app/write/actions';
import { CATEGORIES } from '@/lib/categories';
import type { PostDetail } from '@/lib/types';
import { Markdown } from './Markdown';
import styles from './PostEditor.module.css';

interface Props {
  /** 수정 모드일 때의 기존 글. 새 글이면 undefined. */
  post?: PostDetail;
}

export function PostEditor({ post }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(savePost, {});
  const [body, setBody] = useState(post?.body ?? '');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [thumbnailUrl, setThumbnailUrl] = useState(post?.thumbnail_url ?? '');

  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>{post ? '글 수정' : '새 글'}</h1>

      <form action={formAction} className={styles.form}>
        {post && <input type="hidden" name="id" value={post.id} />}

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
          {/* M1 에는 업로드가 없다(§8 미결정). 그때까지는 외부 URL 을 직접 넣는다. */}
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

          {/* 미리보기로 넘어가도 textarea 를 언마운트하지 않는다.
              언마운트하면 폼 제출에서 body 가 통째로 빠진다. */}
          <textarea
            id="body"
            name="body"
            className={styles.textarea}
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
          <SubmitButton name="status" value="published" variant="primary">
            발행
          </SubmitButton>
          <SubmitButton name="status" value="draft" variant="secondary">
            임시저장
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

function SubmitButton({
  name,
  value,
  variant,
  children,
}: {
  name: string;
  value: string;
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={styles[variant]}
      disabled={pending}
    >
      {children}
    </button>
  );
}
