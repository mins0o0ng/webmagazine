import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** 로그인이 있어야 들어갈 수 있는 경로. */
const PROTECTED = ['/me'];

/**
 * 하는 일 두 가지.
 *
 * 1. 액세스 토큰 갱신. 서버 컴포넌트는 쿠키를 쓸 수 없으므로 갱신된 토큰을
 *    응답에 실어줄 수 있는 곳이 미들웨어뿐이다. 이게 없으면 한 시간쯤 뒤
 *    사용자가 조용히 로그아웃된다.
 * 2. 보호 라우트 차단.
 *
 * 주의: 여기서 반환하는 response 객체를 그대로 돌려줘야 한다. 새로 만들면
 * 갱신된 쿠키가 사라진다.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser() 를 써야 한다. getSession() 은 쿠키 안의 JWT 를 검증 없이 그대로
  // 믿기 때문에 인가 판단의 근거로 쓸 수 없다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // 이미 로그인한 사람에게 로그인·가입 화면을 보여줄 이유가 없다.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자산과 이미지 최적화 요청에서는 토큰을 갱신할 필요가 없다.
    '/((?!_next/static|_next/image|favicon.ico|feed.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
