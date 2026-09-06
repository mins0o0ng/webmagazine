import type { Metadata } from 'next';
import { Black_Han_Sans, Noto_Sans_KR } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';
import './globals.css';

/* 디자인 2b 의 지정 서체.
 * 표제는 Black Han Sans(400 한 종), 본문은 Noto Sans KR.
 * 기획안 §8 의 Pretendard 미결정 항목은 디자인이 이 둘을 지정하면서 정리됐다. */
const displayFont = Black_Han_Sans({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-black-han-sans',
});

const bodyFont = Noto_Sans_KR({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-kr',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  alternates: {
    types: { 'application/rss+xml': '/feed.xml' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
