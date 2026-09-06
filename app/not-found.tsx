import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div
        style={{
          maxWidth: 'var(--measure)',
          marginInline: 'auto',
          paddingBlock: 'var(--space-24)',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-headline)',
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          찾는 글이 없습니다
        </h1>
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--color-ink-muted)' }}>
          주소가 바뀌었거나, 아직 발행되지 않은 글일 수 있습니다.
        </p>
        <p style={{ marginTop: 'var(--space-6)' }}>
          <Link href="/" style={{ textDecoration: 'underline' }}>
            홈으로
          </Link>
        </p>
      </div>
    </div>
  );
}
