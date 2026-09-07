'use client';

import styles from './MarkdownToolbar.module.css';

export interface Edit {
  value: string;
  /** 편집 후 커서(또는 선택 범위). PostEditor 가 렌더 뒤에 적용한다. */
  start: number;
  end: number;
}

interface Props {
  /** 현재 본문. 선택 범위는 textarea 에서 직접 읽는다. */
  textarea: () => HTMLTextAreaElement | null;
  onEdit: (edit: Edit) => void;
}

/**
 * 마크다운 툴바 (M2-2).
 *
 * 기본 여덟 개만 둔다. 리치 에디터를 붙이지 않는다는 기획안 §6 M1 의 결정은
 * 그대로 두되, 초대제로 외부 필자를 받기 시작한 이상 `##` 와 `![]()` 를
 * 외우게 하는 건 다른 문제라서 그 사이를 메운다.
 *
 * 툴바가 textarea 를 직접 고치지 않고 Edit 을 돌려주는 이유: 본문은 React state 라
 * DOM 을 직접 쓰면 다음 렌더에서 되돌아간다. 커서 위치도 렌더 뒤에 잡아야 한다.
 */
export function MarkdownToolbar({ textarea, onEdit }: Props) {
  /** 선택한 부분을 앞뒤로 감싼다. 선택이 없으면 자리표시자를 넣고 그걸 선택해 둔다. */
  function wrap(before: string, after: string, placeholder: string) {
    const ta = textarea();
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e) || placeholder;
    onEdit({
      value: value.slice(0, s) + before + selected + after + value.slice(e),
      start: s + before.length,
      end: s + before.length + selected.length,
    });
  }

  /** 선택한 줄 전부의 앞에 표식을 붙인다. 이미 붙어 있으면 뗀다. */
  function prefixLines(mark: string) {
    const ta = textarea();
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;

    const from = value.lastIndexOf('\n', s - 1) + 1;
    const toIdx = value.indexOf('\n', e);
    const to = toIdx === -1 ? value.length : toIdx;

    const block = value.slice(from, to);
    const lines = block.split('\n');
    const allMarked = lines.every((l) => l.startsWith(mark));
    const next = lines
      .map((l) => (allMarked ? l.slice(mark.length) : mark + l))
      .join('\n');

    onEdit({
      value: value.slice(0, from) + next + value.slice(to),
      start: from,
      end: from + next.length,
    });
  }

  /** 문단 사이에 통째로 끼워 넣는다. 구분선처럼 줄 하나를 차지하는 것들. */
  function insertBlock(text: string) {
    const ta = textarea();
    if (!ta) return;
    const { selectionStart: s, value } = ta;
    const before = value.slice(0, s);
    const pad = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const inserted = `${pad}${text}\n\n`;
    onEdit({
      value: before + inserted + value.slice(s),
      start: s + inserted.length,
      end: s + inserted.length,
    });
  }

  return (
    <div className={styles.bar} role="toolbar" aria-label="마크다운 서식">
      <button type="button" className={styles.button} onClick={() => wrap('**', '**', '굵게')} title="굵게">
        <strong>B</strong>
      </button>
      <button type="button" className={styles.button} onClick={() => wrap('*', '*', '기울임')} title="기울임">
        <em>I</em>
      </button>

      <span className={styles.sep} aria-hidden="true" />

      <button type="button" className={styles.button} onClick={() => prefixLines('## ')} title="소제목">
        H2
      </button>
      <button type="button" className={styles.button} onClick={() => prefixLines('> ')} title="인용">
        &ldquo;
      </button>
      <button type="button" className={styles.button} onClick={() => prefixLines('- ')} title="목록">
        &bull;
      </button>

      <span className={styles.sep} aria-hidden="true" />

      <button
        type="button"
        className={styles.button}
        onClick={() => wrap('[', '](https://)', '링크 글자')}
        title="링크"
      >
        링크
      </button>
      <button
        type="button"
        className={styles.button}
        // 업로드는 아직 없다(§8 미결정). 그때까지는 주소를 직접 넣는 자리를 만들어 준다.
        onClick={() => insertBlock('![](https://)')}
        title="이미지 — 주소를 직접 넣습니다"
      >
        이미지
      </button>
      <button type="button" className={styles.button} onClick={() => insertBlock('---')} title="구분선">
        &mdash;
      </button>
    </div>
  );
}
