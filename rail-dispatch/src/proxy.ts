import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'cco_session_token';
const SESSION_COOKIE_VALUE = 'authenticated_session';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthApiRoute = pathname === '/api/auth' || pathname.startsWith('/api/auth/');

  if (isAuthApiRoute) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value === SESSION_COOKIE_VALUE;

  if (pathname === '/login') {
    return hasSession
      ? NextResponse.redirect(new URL('/', request.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
