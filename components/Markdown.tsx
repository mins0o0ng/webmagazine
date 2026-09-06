import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 본문 렌더러.
 *
 * react-markdown 은 기본적으로 원시 HTML 을 렌더하지 않는다. rehype-raw 를 붙이면
 * 그 순간 본문이 XSS 경로가 된다 — M2 에서 타인 기고가 열리면 치명적이므로,
 * 지금 편해 보인다는 이유로 붙이지 않는다.
 *
 * 서버/클라이언트 양쪽에서 쓴다(글 상세는 서버, /write 미리보기는 클라이언트).
 */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}
