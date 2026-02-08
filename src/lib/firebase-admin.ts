import * as admin from 'firebase-admin';

function formatPrivateKey(key: string) {
  return key.replace(/\\n/g, '\n');
}

export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
       // Allow build to pass if env vars are missing, but runtime will fail if accessed
       if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
          // We are likely in build or runtime. 
          // If we throw here, build fails if it tries to execute this path.
          // But 'next build' generates static pages. 
       }
       throw new Error('Firebase Admin environment variables missing');
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
        }),
      });
    } catch (error) {
      console.error('Firebase Admin init error', error);
      throw error;
    }
  }
  return admin;
}

export const getAdminDb = () => getFirebaseAdmin().firestore();
export const getAdminAuth = () => getFirebaseAdmin().auth();
