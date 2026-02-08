import * as admin from 'firebase-admin';

function formatPrivateKey(key: string) {
  return key.replace(/\\n/g, '\n');
}

export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      const missingVars = [
        'FIREBASE_ADMIN_PROJECT_ID',
        'FIREBASE_ADMIN_CLIENT_EMAIL',
        'FIREBASE_ADMIN_PRIVATE_KEY',
      ].filter((name) => !process.env[name as keyof NodeJS.ProcessEnv]);

      throw new Error(
        `Firebase Admin environment variables missing: ${missingVars.join(', ')}`,
      );
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
