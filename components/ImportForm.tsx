'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { importDrafts, type ImportState } from '@/app/write/actions';
import { parseDrafts } from '@/lib/importMarkdown';
import styles from './ImportForm.module.css';

/**
 * 원고 붙여넣기 (M2-3).
 *
 * 노션에서 복사 → 여기 붙여넣기 → 초안. supabase/seed_posts.sql 처럼 INSERT 문을
 * 손으로 짜던 경로를 대신한다.
 *
 * 저장하기 전에 몇 편이 인식됐는지 먼저 보여준다. 규칙이 아무리 단순해도
 * 파서가 사람의 원고를 어떻게 쪼갰는지는 눌러보기 전에 알 수 있어야 한다.
 */
export function ImportForm() {
  const [state, formAction] = useActionState<ImportState, FormData>(importDrafts, {});
  const [text, setText] = useState('');

  // 브라우저에서 같은 파서를 한 번 더 돌린다. 서버가 볼 결과와 같다.
  const preview = text.trim() ? parseDrafts(text) : [];

  if (state.created) return <Done created={state.created} />;

  return (
    <div className={`page ${styles.wrap}`}>
      <p className="kicker">가져오기</p>
      <h1 className={styles.title}>원고 붙여넣기</h1>
      <p className={styles.lede}>
        노션이나 다른 곳에 써둔 글을 그대로 붙여넣으면 초안으로 들어옵니다.
        발행은 각 글을 열어 부제와 카테고리를 채운 뒤에 누르세요.
      </p>

      <form action={formAction} className={styles.form}>
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="text">
              원고
            </label>
            {preview.length > 0 && (
              <span className={styles.counter}>{preview.length}편 인식됨</span>
            )}
          </div>
          <textarea
            id="text"
            name="text"
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            required
          />
        </div>

        <details className={styles.rules}>
          <summary className={styles.rulesSummary}>쪼개는 규칙</summary>
          <ul className={styles.rulesList}>
            <li>
              <code>===</code> 만 있는 줄이 글과 글의 경계입니다.
            </li>
            <li>
              각 글의 첫 <code># 제목</code> 줄이 제목입니다. 없으면 첫 줄을 제목으로 씁니다.
            </li>
            <li>
              제목 바로 다음 <code>&gt; 부제</code> 줄이 있으면 부제로 읽습니다.
            </li>
            <li>
              <code>[카테고리: essay]</code> 줄이 있으면 카테고리로 읽습니다.
              (essay / place / love / life / pick)
            </li>
            <li>부제와 카테고리는 없어도 됩니다. 화면에서 채우면 됩니다.</li>
          </ul>
        </details>

        {preview.length > 0 && <Preview drafts={preview} />}

        <div className={styles.actions}>
          <Submit count={preview.length} />
          <Link href="/me" className={styles.cancel}>
            그만두기
          </Link>
        </div>
      </form>
    </div>
  );
}

function Preview({ drafts }: { drafts: ReturnType<typeof parseDrafts> }) {
  return (
    <div className={styles.preview}>
      <h2 className={styles.previewTitle}>이렇게 들어갑니다</h2>
      <ol className={styles.previewList}>
        {drafts.map((d, i) => (
          <li key={i} className={styles.previewItem}>
            <div className={styles.previewHead}>
              <span className={styles.previewNum}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.previewName}>{d.title || '(제목 없음)'}</span>
              <span className={styles.previewLen}>{d.body.length}자</span>
            </div>
            {d.deck && <p className={styles.previewDeck}>{d.deck}</p>}
            {d.warnings.length > 0 && (
              <ul className={styles.previewWarn}>
                {d.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Done({ created }: { created: NonNullable<ImportState['created']> }) {
  return (
    <div className={`page ${styles.wrap}`}>
      <p className="kicker">가져오기</p>
      <h1 className={styles.title}>{created.length}편을 초안으로 들여왔습니다</h1>
      <p className={styles.lede}>
        아직 아무것도 발행되지 않았습니다. 각 글을 열어 부제와 카테고리를 확인한 뒤
        발행하세요.
      </p>

      <ol className={styles.doneList}>
        {created.map((c, i) => (
          <li key={c.id} className={styles.doneItem}>
            <span className={styles.previewNum}>{String(i + 1).padStart(2, '0')}</span>
            <Link href={`/write/${c.id}`} className={styles.doneLink}>
              {c.title}
            </Link>
            {c.warnings.length > 0 && (
              <span className={styles.doneWarn}>{c.warnings.length}가지 확인 필요</span>
            )}
          </li>
        ))}
      </ol>

      <div className={styles.actions}>
        <Link href="/me" className={styles.primary}>
          내 글로 가기
        </Link>
      </div>
    </div>
  );
}

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending || count === 0}>
      {count > 0 ? `${count}편 초안으로 가져오기` : '가져오기'}
    </button>
  );
}

const PLACEHOLDER = `# 행복의 반의어
> 다자이 오사무가 남긴 마지막 질문
[카테고리: essay]

“부끄러움 많은 생애를 보냈습니다.” ‘인간 실격’의 첫 문장이다…

===

# 존재
> 인공지능 앞에서 다시 묻는 하이데거

“나는 생각한다. 고로 존재한다”…`;
