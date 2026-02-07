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
- **Hybrid Fetching**: To maintain performance as data scales, the app uses a hybrid approach:
  - **Windowed**: High-volume data (Transactions, Allocations) is strictly windowed by the active month.
  - **Global (Filtered)**: Critical state items (Uncleared transactions) are fetched globally with a reasonable limit (e.g., 100) to ensure they are always accounted for in budget calculations.
- **FinanceContext**: Centralizes `selectedMonth` and `refreshTransactions` logic to eliminate prop-drilling.

### Key Components
- `src/hooks/useFinanceData.ts`: Core data synchronization and recursive budget calculation.
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

### 5. Known Traps
- **Infinite Effect Loops**: Never include a state variable in a dependency array if the effect's callback updates that same state. Use a `ref` overlay instead.
- **Multi-Tab Persistence**: `failed-precondition` errors occur if multiple tabs attempt to enable persistence simultaneously. Always wrap initialization in a `catch` block.

## Search Strategy

- **Keyword Search**: Uses Firestore prefix queries (`>=` and `<= \uf8ff`).
- **Range Limitation**: Since Firestore doesn't support multiple range queries on different fields, **date windowing is disabled during active search** to allow for global search.
- **Limitation**: Search is currently case-sensitive. Implement a `payee_lower` field if case-insensitivity is required.