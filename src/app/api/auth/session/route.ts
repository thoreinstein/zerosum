import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    // Create session cookie (valid for 5 days)
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.json({ status: 'success' }, { status: 200 });

    // Set cookie on response
    response.cookies.set('session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating session cookie:', message);
    
    if (message.includes('environment variables missing')) {
      return NextResponse.json({ 
        error: 'Server misconfiguration: Firebase Admin keys are missing. See SETUP.md.' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'Internal server error during session creation' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: 'success' }, { status: 200 });
  response.cookies.delete('session');
  return response;
}
