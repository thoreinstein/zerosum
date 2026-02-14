const assert = require('assert');

// Mocking the logic in middleware.ts
function simulateMiddleware(pathname, session, isValidSession) {
  const isApiRoute = pathname.startsWith('/api');
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/api/auth');

  // 1. Handle protected routes
  if (!isAuthRoute) {
    if (!session) {
      if (isApiRoute) {
        return { type: 'json', status: 401, error: 'Unauthorized' };
      }
      return { type: 'redirect', url: '/login' };
    }

    const isValid = isValidSession;
    if (!isValid) {
      if (isApiRoute) {
        return { type: 'json', status: 401, error: 'Unauthorized' };
      }
      return { type: 'redirect', url: '/login', deleteSession: true };
    }
  }

  // 2. Handle login page redirect if already authenticated
  if (pathname.startsWith('/login') && session) {
    const isValid = isValidSession;
    if (isValid) {
      return { type: 'redirect', url: '/' };
    }
  }

  return { type: 'next' };
}

// Test cases
const tests = [
  // Public UI routes
  { pathname: '/login', session: null, isValid: false, expected: { type: 'next' } },
  { pathname: '/login', session: 'val', isValid: true, expected: { type: 'redirect', url: '/' } },

  // Public API routes
  { pathname: '/api/auth/session', session: null, isValid: false, expected: { type: 'next' } },
  { pathname: '/api/auth/session', session: 'val', isValid: true, expected: { type: 'next' } },

  // Protected UI routes
  { pathname: '/', session: null, isValid: false, expected: { type: 'redirect', url: '/login' } },
  { pathname: '/dashboard', session: 'val', isValid: true, expected: { type: 'next' } },
  { pathname: '/dashboard', session: 'val', isValid: false, expected: { type: 'redirect', url: '/login', deleteSession: true } },

  // Protected API routes
  { pathname: '/api/data', session: null, isValid: false, expected: { type: 'json', status: 401, error: 'Unauthorized' } },
  { pathname: '/api/data', session: 'val', isValid: true, expected: { type: 'next' } },
  { pathname: '/api/data', session: 'val', isValid: false, expected: { type: 'json', status: 401, error: 'Unauthorized' } },
];

tests.forEach((test, index) => {
  const result = simulateMiddleware(test.pathname, test.session, test.isValid);
  try {
    assert.deepStrictEqual(result, test.expected);
    console.log(`Test ${index + 1} passed: ${test.pathname} (session: ${test.session})`);
  } catch (err) {
    console.error(`Test ${index + 1} failed: ${test.pathname}`);
    console.error(`  Expected: `, test.expected);
    console.error(`  Actual:   `, result);
    process.exit(1);
  }
});

console.log('All middleware logic tests passed!');

// Regex test
// Next.js matcher '/((?!_next/static|_next/image|favicon.ico).*)'
// matches everything except those prefixes.
const regex = /^\/(?!(_next\/static|_next\/image|favicon\.ico)).*/;

const matcherTests = [
    { path: '/api/data', match: true },
    { path: '/api/auth/session', match: true },
    { path: '/_next/static/main.js', match: false },
    { path: '/_next/image/photo.jpg', match: false },
    { path: '/favicon.ico', match: false },
    { path: '/', match: true },
    { path: '/login', match: true },
];

matcherTests.forEach((test, index) => {
    const isMatch = regex.test(test.path);
    if (isMatch !== test.match) {
        console.error(`Matcher Test ${index + 1} failed for ${test.path}. Expected match: ${test.match}, Got: ${isMatch}`);
        process.exit(1);
    } else {
        console.log(`Matcher Test ${index + 1} passed: ${test.path}`);
    }
});

console.log('All matcher tests passed!');
