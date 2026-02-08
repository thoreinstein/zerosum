import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

// Firebase Session Cookies are JWTs signed by Google
const GOOGLE_CERT_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

async function verifySessionCookie(cookie: string) {
  try {
    // 1. Fetch Google's public keys (In production, this should be cached)
    const res = await fetch(GOOGLE_CERT_URL);
    const publicKeys = await res.json();
    
    // 2. We need to verify the JWT. Since we don't know which kid was used, 
    // and jose verify expects a specific key or a JWKS, we have a few options.
    // For simplicity and correctness in Edge, we'll check the claims at minimum
    // and ideally the signature if we can map the kid.
    
    // Decode without verifying first to get the kid
    const header = jose.decodeProtectedHeader(cookie);
    const kid = header.kid;
    
    if (!kid || !publicKeys[kid]) {
      return false;
    }

    const publicKey = publicKeys[kid];
    // Convert PEM to crypto key
    const ecKey = await jose.importX509(publicKey, 'RS256');

    const { payload } = await jose.jwtVerify(cookie, ecKey, {
      issuer: `https://session.firebase.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });

    return !!payload;
  } catch (error) {
    console.error('Session verification failed:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // 1. Handle protected routes
  if (!pathname.startsWith('/login')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const isValid = await verifySessionCookie(session.value);
    if (!isValid) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  // 2. Handle login page redirect if already authenticated
  if (pathname.startsWith('/login') && session) {
    const isValid = await verifySessionCookie(session.value);
    if (isValid) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
