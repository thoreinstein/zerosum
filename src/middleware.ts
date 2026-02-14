import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';

// Firebase Session Cookies are JWTs signed by Google
const GOOGLE_CERT_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

type CertCache = {
  keys: Record<string, string>;
  expiresAt: number;
};

let certCache: CertCache | null = null;
let pendingCertFetch: Promise<Record<string, string> | null> | null = null;

function parseMaxAge(cacheControl: string | null): number {
  if (!cacheControl) {
    return 300;
  }

  const match = cacheControl.match(/max-age=(\d+)/);
  if (!match) {
    return 300;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

async function fetchGooglePublicKeys(): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) {
    return certCache.keys;
  }

  if (pendingCertFetch) {
    return pendingCertFetch;
  }

  pendingCertFetch = (async () => {
    try {
      const res = await fetch(GOOGLE_CERT_URL, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to fetch certs: ${res.status}`);
      }

      const keys = (await res.json()) as Record<string, string>;
      const ttlSeconds = parseMaxAge(res.headers.get('cache-control'));

      certCache = {
        keys,
        expiresAt: Date.now() + ttlSeconds * 1000,
      };

      return keys;
    } catch (error) {
      // Prefer stale cached keys over forcing a global auth outage on transient failures.
      if (certCache) {
        return certCache.keys;
      }
      console.error('Unable to refresh Google public keys:', error);
      return null;
    } finally {
      pendingCertFetch = null;
    }
  })();

  return pendingCertFetch;
}

async function verifySessionCookie(cookie: string) {
  try {
    const publicKeys = await fetchGooglePublicKeys();
    if (!publicKeys) {
      return false;
    }
    
    // 2. We need to verify the JWT. Since we don't know which kid was used, 
    // and jose verify expects a specific key or a JWKS, we have a few options.
    // For simplicity and correctness in Edge, we'll check the claims at minimum
    // and ideally the signature if we can map the kid.
    
    // Decode without verifying first to get the kid
    const header = decodeProtectedHeader(cookie);
    const kid = header.kid;
    
    if (!kid || !publicKeys[kid]) {
      return false;
    }

    const publicKey = publicKeys[kid];
    // Convert PEM to crypto key (RSA, used with RS256)
    const rsaKey = await importX509(publicKey, 'RS256');

    const { payload } = await jwtVerify(cookie, rsaKey, {
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
  const isApiRoute = pathname.startsWith('/api');
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/api/auth');

  // 1. Handle protected routes
  if (!isAuthRoute) {
    if (!session) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const isValid = await verifySessionCookie(session.value);
    if (!isValid) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
