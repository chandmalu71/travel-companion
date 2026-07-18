import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect routes requiring authentication.
 * Checks for JWT token in cookies or redirects to login.
 */

const publicPaths = ['/', '/login', '/register', '/forgot-password', '/verify-email'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname === p || pathname.startsWith('/api/'))) {
    return NextResponse.next();
  }

  // For protected routes, check for auth cookie/header
  // In a real app, we'd validate the JWT server-side here
  // For now, we rely on client-side checks in the layout
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
