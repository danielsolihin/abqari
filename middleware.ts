import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuth = request.cookies.has('abqari_session');
  const isLoginPage = path === '/login';

  // Jika tiada akses dan bukan di laman login -> hantar ke /login
  if (!isAuth && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Jika dah login tapi cuba buka /login -> hantar ke dashboard (/)
  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Menyediakan default export sebagai simpanan keselamatan untuk Next.js
export default middleware;

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.docx|.*\\.svg).*)',
  ],
};