import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextFetchEvent, NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/']);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return NextResponse.next();
  }

  return clerkMiddleware((auth, request) => {
    if (isProtectedRoute(request)) auth().protect();
  })(req, event);
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
