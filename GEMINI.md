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

### Data Fetching strategy
- **Current Fetching Model**: `useFinanceData` subscribes to all transactions (ordered by `date` descending) and all monthly allocations, then derives month-scoped views in memory.
  - **Month-Scoped Views**: High-volume data (Transactions, Allocations) is filtered by the active month in application logic and UI components rather than via Firestore query constraints.
  - **Global (Limited)**: Critical state items (e.g., uncleared transactions) are fetched or derived globally with reasonable limits (e.g., 100) so they are always accounted for in budget calculations.
- **FinanceContext**: Centralizes `selectedMonth` and `refreshTransactions` logic to eliminate prop-drilling and drive the month-based filtering of subscribed data.
- **Windowed Prefetching**: A `useSubscriptionPool` hook in the context manages background listeners for the `next` and `previous` months. This uses a 2-second idle delay to optimize quota usage.
- **Result Caching**: Calculated budget states (Available, Activity, etc.) are cached in `FinanceContext.budgetCache` to allow instant UI hydration during navigation.

### Key Components
- `src/hooks/useFinanceData.ts`: Core data synchronization and recursive budget calculation.
- `src/hooks/useSubscriptionPool.ts`: Manages background Firestore listeners for adjacent data sets.
- `src/hooks/usePaginatedTransactions.ts`: Independent hook for cursor-based transaction list fetching.
- `src/components/views/`: Main content areas (Budget, Accounts, Transactions, Reports).

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

## Development Conventions

- **State Management**: Uses custom hooks (`useFinanceData`) combined with Firestore listeners.
- **Listener Safety**: 
  - Never check external state inside an `onSnapshot` callback (closure staleness). Use a dedicated `useEffect` tracking both states for cross-validation or bootstrapping.
  - Store pagination cursors (`lastDoc`) and lock flags in `useRef` to maintain stable hook identities.
- **Mutations**: Use `writeBatch` for atomic operations involving multiple documents.
- **Styling**: Utility-first CSS using Tailwind CSS 4. Follow established patterns in `src/app/globals.css`.

## Database Schema

- `users/{uid}/accounts/{accId}`
- `users/{uid}/categories/{catId}`
- `users/{uid}/transactions/{txId}`
- `users/{uid}/monthly_allocations/{month_catId}`

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

### 5. Subscription Pool Pattern
Centralize background listener management in a "Pool" hook to support windowed fetching. Use an idle delay (debounce) before attaching new listeners to avoid redundant reads during rapid navigation.

### 6. Known Traps
- **Infinite Effect Loops**: Never include a state variable in a dependency array if the effect's callback updates that same state. Use a `ref` overlay instead.
- **Multi-Tab Persistence**: `failed-precondition` errors occur if multiple tabs attempt to enable persistence simultaneously. Always wrap initialization in a `catch` block.
- **Async Cleanup**: Always `clearTimeout` or cancel async operations in hook cleanup. Use the `user` object in dependency arrays to ensure background timers don't trigger state updates after logout.
- **Multi-Stream Readiness**: When combining multiple Firestore streams, track readiness flags for each individually. Only set a global "synced" status when all required streams have emitted a non-cached snapshot.

### 7. Date Handling
- **Timezone-Safe Month Boundaries**: When filtering by month, avoid `new Date().setMonth()` which depends on the browser's local timezone. Use string manipulation (e.g., `YYYY-MM-01`) or UTC-explicit logic to ensure consistent query ranges across all timezones.

### 8. Pagination & Retries
- **Preserve Pagination State on Error**: When a fetch fails, do not set `hasMore` to `false`. Keeping it `true` allows the user to click "Retry" and re-attempt the fetch.

### 9. Session Loading State
- **Explicit Loading Initialization**: Always explicitly set `loading = true` when a user session begins (e.g., inside the `useEffect` triggered by `user`). This prevents the UI from momentarily rendering "Empty" or "Seed Data" states while waiting for the first Firestore snapshot.

### 10. Auth State Race Conditions
**Trap**: Navigating immediately after a client-side login (before the server-side session cookie is synced) causes the Middleware to redirect back to `/login`.
**Mitigation**: Treat session cookie synchronization as a blocking dependency. Only navigate to protected routes *after* the `fetch('/api/auth/session')` call succeeds in the `onAuthStateChanged` listener.

### 11. JIT Admin Initialization
**Pattern**: Wrap `firebase-admin` initialization in a getter (`getFirebaseAdmin()`) rather than executing it at the top level. This prevents build failures in CI/CD environments where production secrets (like private keys) are not available.

### 12. Lightweight JWT Verification (Edge-Safe)
**Pattern**: Use `jose` to verify session cookies in Next.js Middleware. Since the Edge Runtime cannot use `firebase-admin` (Node.js only), manually fetch Google's public keys and verify the token signature to prevent auth bypass.

### 13. Session Cookies for SSR
**Decision**: Use HTTP-only session cookies to bridge Firebase's client-side auth with Next.js Server Components and Middleware. This allows for secure, server-side route protection without relying on client-side headers for initial page loads.

## Search Strategy

- **Keyword Search**: Uses Firestore prefix queries (`>=` and `<= \uf8ff`).
- **Range Limitation**: Since Firestore doesn't support multiple range queries on different fields, **date windowing is disabled during active search** to allow for global search.
- **Limitation**: Search is currently case-sensitive. Implement a `payee_lower` field if case-insensitivity is required.
