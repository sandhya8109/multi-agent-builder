import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isProtectedPath(pathname: string) {
  return pathname === '/' || pathname.startsWith('/workflows');
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith('sb-') &&
        (cookie.name.includes('auth-token') || cookie.name.includes('refresh-token'))
    );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const hasDemoSession = request.cookies.get('demo_session')?.value === 'true';

  if (!isProtectedPath(pathname) || hasDemoSession || hasSupabaseSessionCookie(request)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/', '/login', '/workflows/:path*'],
};
