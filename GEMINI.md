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
