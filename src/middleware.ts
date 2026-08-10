import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Define domains that should be treated as customer-only domains
  const customerDomain = process.env.NEXT_PUBLIC_CUSTOMER_DOMAIN || 'play-8bit.com';
  
  // A request is treated as customer-domain if:
  // 1. It exactly matches the configured customer domain
  // 2. It uses a "play." or "scan." subdomain
  const isCustomerDomain = 
    hostname.includes(customerDomain) || 
    hostname.startsWith('play.') || 
    hostname.startsWith('scan.');

  if (isCustomerDomain) {
    // Allow Next.js static files, assets, public images, and the /scan page
    const isStaticAsset = 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/static') || 
      pathname.includes('.') || 
      pathname === '/favicon.ico';

    const isAllowedRoute = 
      pathname === '/scan' || 
      isStaticAsset;

    if (!isAllowedRoute) {
      // Force block any admin/dashboard routes, returning 404
      return new NextResponse('Not Found', { status: 404 });
    }

    // If the customer visits the root domain index '/', redirect or rewrite to '/scan'
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/scan', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (/api/*)
     * - static files
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
