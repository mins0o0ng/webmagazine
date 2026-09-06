import { listPublished } from '@/lib/posts';

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const TITLE = '웹매거진';
const DESCRIPTION = '읽을 만한 글을 모읍니다.';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const posts = await listPublished({ limit: 30 });

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/p/${post.id}`;
      const pubDate = post.published_at
        ? new Date(post.published_at).toUTCString()
        : new Date(post.created_at).toUTCString();

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(post.deck)}</description>
      <author>${escapeXml(post.author?.display_name ?? '')}</author>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>ko</language>
    <atom:link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
