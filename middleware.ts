import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Semak sama ada pengguna mempunyai cookie sesi ABQARI
  const hasSession = request.cookies.has('abqari_session');
  const { pathname } = request.nextUrl;

  // 1. SENARAI LALUAN AWAM (Boleh diakses tanpa log masuk)
  const publicPaths = ['/login', '/forgot-password', '/reset-password'];

  // Jika laluan semasa ada dalam senarai awam, benarkan akses masuk
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // 2. Jika cuba masuk Papan Pemuka/Sistem tapi tiada sesi, tendang ke /login
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Jika semuanya okey, benarkan akses diteruskan
  return NextResponse.next();
}

// Konfigurasi Matcher: Abaikan fail statik, imej, dan API supaya tidak disekat
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};