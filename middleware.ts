import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('abqari_session');
  const { pathname } = request.nextUrl;

  // 1. SENARAI LALUAN AWAM
  const publicPaths = ['/login', '/forgot-password', '/reset-password'];

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // 2. MOD UJIAN SEMENTARA (BYPASS LOG MASUK):
  // Baris di bawah dilumpuhkan sementara supaya Prof tidak ditendang ke /login semasa menguji
  /*
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  */

  // 3. Benarkan semua akses terus masuk
  return NextResponse.next();
}

// Konfigurasi Matcher: Abaikan fail statik, imej, dan API supaya tidak disekat
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};