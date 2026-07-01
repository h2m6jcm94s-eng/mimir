import { type NextFetchEvent, NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(_req: NextRequest, _event: NextFetchEvent) {
  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return NextResponse.next();
  }

  // Supertokens session cookies are verified by the API. This middleware only
  // handles lightweight routing concerns; heavier checks live server-side.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
