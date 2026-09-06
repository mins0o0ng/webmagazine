import type { Metadata } from 'next';

export const metadata: Metadata = { title: '소개' };

export default function AboutPage() {
  return (
    <div className="page">
      <article
        style={{
          maxWidth: 'var(--measure)',
          marginInline: 'auto',
          paddingBlock: 'var(--space-16)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--text-headline)',
            letterSpacing: 'var(--tracking-tight)',
            marginBottom: 'var(--space-6)',
          }}
        >
          소개
        </h1>
        {/* 실제 소개 문구는 편집 결정 사항이라 비워둔다. */}
        <p style={{ color: 'var(--color-ink-muted)', lineHeight: 'var(--leading-loose)' }}>
          소개 문구를 아직 쓰지 않았습니다.
        </p>
      </article>
    </div>
  );
}
