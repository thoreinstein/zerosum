# zerosum - Gemini CLI Context

This document provides essential context for Gemini CLI interactions within the `zerosum` project.

## Project Overview

**zerosum** is a personal zero-sum budgeting application built with modern web technologies. It allows users to track accounts, manage categorized budgets, and process transactions with an emphasis on "giving every dollar a job."

### Core Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **AI Integration**: GenKit with Google AI (Gemini 1.5 Flash) for receipt scanning
- **Styling**: Tailwind CSS 4 & Lucide React icons

## Architecture & Structure

- `src/app`: Contains the application pages and Server Actions.
  - `actions/scanReceipt.ts`: AI-powered logic to extract data from receipt images.
- `src/components`: UI components organized by responsibility.
  - `views/`: Main content areas (Budget, Accounts, Transactions, Reports).
  - `modals/`: Interactive dialogs for creating transactions and categories.
  - `layout/`: Persistent UI elements like Sidebar and Header.
- `src/hooks`: Custom React hooks for business logic.
  - `useFinanceData.ts`: Centralizes Firestore real-time synchronization and data mutations (add/update/delete).
- `src/context`: `AuthContext.tsx` manages Firebase authentication state.
- `src/lib`: Initializations for `firebase.ts` (client), `firebase-admin.ts` (server), and `genkit.ts` (AI).

## Key Features

- **Zero-Sum Budgeting**: Users allocate their total balance across categories.
- **Real-time Data**: Firestore `onSnapshot` is used for live updates across the UI.
- **Transaction Workflow**: Support for cleared, uncleared, and reconciled statuses.
- **AI Receipt Scanning**: Uses GenKit to extract payee, date, amount, and category from uploaded images.
- **Dark Mode**: Fully responsive UI with native dark mode support.

## Building and Running

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### Firebase Emulators (Optional)
```bash
npm run firebase:emulators
```

## Development Conventions

- **State Management**: Uses custom hooks (`useFinanceData`) combined with Firestore listeners instead of heavy state libraries.
- **Mutations**: Use `writeBatch` for atomic operations involving multiple documents (e.g., adding a transaction and updating account balance).
- **Server Actions**: Preferred for AI processing and sensitive server-side operations.
- **Styling**: Utility-first CSS using Tailwind CSS 4. Follow established patterns in `src/app/globals.css`.
- **Database Schema**:
  - `users/{uid}/accounts/{accId}`
  - `users/{uid}/categories/{catId}`
  - `users/{uid}/transactions/{txId}`

## Architectural Truths & Patterns

### 1. Optimistic Mutation Pattern
To provide instant feedback, updates follow a specific lifecycle:
1. **Immediate State Update**: Update local React state before the server call.
2. **Client-Side ID Generation**: Use Firestore's `doc(collection(db, 'path')).id` to generate IDs on the client.
3. **Async Server Attempt**: Perform the Firestore write within a `try/catch` block.
4. **Rollback on Failure**: Revert local state if the server call fails.
5. **Persistent Retry Store**: Store failed mutation data in `localStorage` and provide a "Retry" UI.

### 2. Dependency Management with `useRef`
When implementing background workers (like the AI Scan Queue), use a `useRef` to hold the latest state (e.g., `transactions`). This breaks infinite re-render loops caused by hooks depending on state they also update.

### 3. Modern Firestore Persistence
Always use `initializeFirestore` with `persistentLocalCache` and `persistentMultipleTabManager()` for multi-tab support. Avoid the deprecated `enableIndexedDbPersistence`.

### 4. Large Asset Caching (IndexedDB)
Use **IndexedDB** for storing large binary or base64 assets (like receipt images) while offline to avoid `localStorage` 5MB quota limits.

### 5. Known Traps
- **Infinite Effect Loops**: Never include a state variable in a dependency array if the effect's callback updates that same state. Use a `ref` overlay instead.
- **Multi-Tab Persistence**: `failed-precondition` errors occur if multiple tabs attempt to enable persistence simultaneously. Always wrap initialization in a `catch` block.

## Search Strategy

- **Keyword Search**: Uses Firestore prefix queries (`>=` and `<= \uf8ff`).
- **Limitation**: Search is currently case-sensitive due to Firestore range query constraints.
- **Recommendation**: For case-insensitive search in the future, implement a `payee_lower` field on transaction documents or integrate a dedicated search provider like Algolia.
