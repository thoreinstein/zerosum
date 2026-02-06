# Zerosum - Setup Guide

This guide will help you set up and configure your Firebase + GenKit + Next.js application.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Firebase account (https://console.firebase.google.com/)
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/thoreinstein/zerosum.git
cd zerosum
```

2. Install dependencies:
```bash
npm install
```

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Follow the setup wizard to create your project
4. Enable the following services:
   - Authentication (Email/Password, Google, etc.)
   - Firestore Database
   - Hosting (optional for deployment)
   - Vertex AI (for GenKit)

### 2. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Under "Your apps", click the web icon (</>)
3. Register your app and copy the configuration values
4. Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

5. Fill in your Firebase configuration in `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 3. Set Up Firebase Admin SDK (for server-side operations)

1. In Firebase Console, go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Add the credentials to `.env.local`:

```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

### 4. Configure Firebase CLI

1. Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Create `.firebaserc` with your project ID:
```bash
cp .firebaserc.example .firebaserc
```

4. Edit `.firebaserc` and update it with your Firebase project ID:
```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

**Note:** `.firebaserc` is gitignored to prevent committing project-specific configuration.

## GenKit Configuration

GenKit is already integrated and ready to use. To start using it:

1. Enable Vertex AI in your Firebase project
2. Configure your GenKit flows in `src/lib/genkit.ts`
3. Create API routes or server functions that use GenKit

## Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building for Production

Build the application:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Deployment

### Deploy to Firebase Hosting

1. Build your application:
```bash
npm run build
```

2. Deploy to Firebase:
```bash
firebase deploy
```

## Project Structure

```
zerosum/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   └── globals.css   # Global styles
│   └── lib/              # Library files
│       ├── firebase.ts        # Firebase client configuration
│       ├── firebase-admin.ts  # Firebase Admin SDK
│       └── genkit.ts          # GenKit configuration
├── public/               # Static files
├── firebase.json         # Firebase configuration
├── .firebaserc          # Firebase project reference
└── package.json         # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run firebase:emulators` - Start Firebase emulators

## Next Steps

1. Set up authentication in your Firebase project
2. Configure Firestore security rules
3. Create your first GenKit flow
4. Build your budgeting features
5. Deploy to Firebase Hosting

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [GenKit Documentation](https://firebase.google.com/docs/genkit)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## Troubleshooting

### Build Errors

If you encounter build errors:
1. Delete `.next` folder: `rm -rf .next`
2. Clear npm cache: `npm cache clean --force`
3. Reinstall dependencies: `rm -rf node_modules && npm install`
4. Try building again: `npm run build`

### Firebase Connection Issues

1. Verify your `.env.local` file exists and has correct values
2. Check Firebase Console for project status
3. Ensure Firebase services are enabled
4. Verify API keys and credentials

## Support

For issues or questions, please open an issue on GitHub.
