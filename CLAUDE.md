# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm start` - Start dev server via CRACO (http://localhost:3000)
- `npm run build` - Production build (runs `generate-build-number.js` pre-build)
- `npm test` - Jest tests in watch mode
- `npm test -- --testNamePattern="ComponentName"` - Run specific test
- `npm run test:coverage` - Coverage report (70% threshold for branches/functions/lines/statements)
- `npm run test:ci` - CI test run (no watch, pass with no tests)
- `npm run lint` / `npm run lint:fix` - ESLint
- `npm run emulators` - Start Firebase emulators (Auth:9099, Firestore:8080, Functions:5001, Hosting:5000, UI:4000)
- `npm run deploy` - Build + deploy to Firebase
- `npm run deploy:hosting` - Deploy hosting only
- `npm run deploy:functions` - Deploy Cloud Functions only

## Architecture Overview

React 19 banking app with Firebase backend, Redux Toolkit state management, and Material-UI (MUI 7) dark theme. Uses CRACO to customize Create React App (prevents Firebase SDK minification issues via TerserPlugin `keep_fnames`/`keep_classnames`).

### Routing Structure

**Public:** `/auth` (AuthPage), `/forceupdate` (ForceUpdatePage)

**Protected (authenticated):** `/dashboard`, `/account`, `/account/:user_id` (admin viewing user), `/withdrawal`, `/profile`, `/about`

**Admin (authenticated + admin):** `/admin` (AdminPanel), `/admin/requests` (AdminRequestsPage), `/admin/logs` (AdminLogs), `/admin/messages` (MessagesPage)

Root `/` redirects to `/admin` (admins), `/account` (users), or `/auth` (unauthenticated).

### Authentication System

Uses **UnifiedAuthProvider** (`src/contexts/UnifiedAuthProvider.js`) as the single source of truth, backed by **UnifiedAuthService** (`src/services/unifiedAuthService.js`).

- **Flow:** Firebase Google OAuth → UnifiedAuthProvider context → Redux (unifiedAuthSlice) → Components
- **Hook:** `useUnifiedAuth()` provides auth state, permissions, and actions
- **Session management:** 30-min token refresh, 8-hour session timeout, rate limiting (5 attempts / 15-min lockout), browser fingerprinting
- **Persistence layers:** localStorage (`mcduck_auth_state`) → sessionStorage → IndexedDB (PWA fallback, has corruption handling)
- **Admin detection:** Custom claims + Firestore `administrator` field + hard-coded email fallback
- **Legacy:** `authSlice.js` exists but `unifiedAuthSlice.js` is the active slice

### State Management (Redux Toolkit)

Store in `src/store/index.js` with custom serialization config.

**Slices:**
- `unifiedAuthSlice` - Auth state, permissions, claims, session (active)
- `authSlice` - Legacy auth state (still present)
- `transactionsSlice` - Transaction data and pending approvals
- `withdrawalRequestsSlice` - Withdrawal request management

**Selectors** (`src/store/selectors.js`): Memoized selectors via `createSelector` for auth, transactions, summaries, pagination, and filtering.

### Firebase / Firestore

**Key collections:**
- `accounts/{email}` - User accounts, **keyed by email** (not UID)
- `transactions/{id}` - Transactions, use `user_id` (UID) field for ownership
- `withdrawal_tasks/{id}` - Withdrawal requests
- `audit_logs/{id}` - Audit trail (create: any auth user, read: admin only)
- `admin_logs/{id}` - Admin-only logs
- `user_settings/{userId}` - User preferences

**Security rules** (`firestore.rules`): Triple-layered permission checks at Firestore rules + service layer + component layer.

### Services (`src/services/`)

| Service | Role |
|---------|------|
| `unifiedAuthService.js` | Auth, sessions, rate limiting, fingerprinting |
| `apiService.js` | Unified Firestore operations layer (replaces deprecated `userService.js`) |
| `transactionService.js` | Transaction retrieval + real-time subscriptions |
| `transactionProcessor.js` | Transaction processing logic |
| `withdrawalTaskService.js` | Withdrawal request CRUD + Telegram notifications |
| `adminCloudFunctions.js` | Callable Cloud Functions (interest, statements, Telegram) |
| `auditService.js` | Comprehensive audit logging |
| `notificationService.js` | FCM push notifications |
| `serverNotificationService.js` | Server-side email (SendGrid) + Telegram notifications |
| `notificationPreferencesService.js` | User notification channel preferences |
| `sendgridService.js` | SendGrid email integration |
| `smsService.js` | SMS sending |
| `permissionService.js` | RBAC permission checking |
| `updateService.js` | PWA service worker update detection |
| `jobsService.js` | Background job management |
| `emailRenderer.js` | HTML email template rendering |

### Cloud Functions (`functions/`)

Firebase Functions v2 with separate `package.json`. Two codebases in `firebase.json`: "default" and "repo".

- **Scheduled:** `calculateMonthlyInterest` (daily 12:00 UTC), `sendStatements` (daily)
- **Callable (admin):** `calculateMonthlyInterest()`, `sendStatements(year, month, customerEmail?)`, `sendTelegram(message, tag)`
- **Integrations:** SendGrid, Telegram Bot API, Axios

### Custom Hooks (`src/hooks/`)

- `useUnifiedAuth` - Primary auth hook (state, actions, permissions, computed props)
- `useAccountData` - Composition hook: user data + transactions + summary
- `useUserData` / `useTransactions` / `useTransactionSummary` - Individual data hooks
- `useFirebaseSubscription` - Real-time Firestore subscription management
- `useNotifications` - FCM notification setup
- `usePWA` - PWA update detection

### Theme

Dark theme in `src/config/darkTheme.js`: primary gold (#F4C14D), secondary green (#3FB984), dark background (#0D1117). Font: Inter.

## Testing

- **Framework:** Jest + React Testing Library, jsdom environment
- **Setup:** `src/setupTests.js` mocks Firebase, IntersectionObserver, ResizeObserver, matchMedia, localStorage/sessionStorage
- **Firebase mock:** `src/__mocks__/firebase.js`
- **Module aliases in tests:** `@components`, `@utils`, `@services`, `@hooks`
- **Test locations:** `src/__tests__/integration/`, `src/components/__tests__/`, `src/utils/__tests__/`
- **Timeout:** 10 seconds per test

## Key Gotchas

- **Account lookup uses email, not UID** — Firestore `accounts` collection is keyed by user email
- **Transaction ownership uses UID** — `user_id` field in transactions is the Firebase UID
- **CRACO required** — All scripts use `craco` (not `react-scripts` directly) to prevent Firebase minification breakage
- **Auth state dual-check** — Always verify both Redux auth state AND Firebase auth state for auth-dependent features
- **Admin claim propagation delay** — Custom claims sync via `onIdTokenChanged`, may have brief delay after setting
- **IndexedDB corruption** — PWA persistence can corrupt; the auth service includes cleanup logic
- **Service error format** — Services return `{ success, error, code, context }` consistently

## Environment Configuration

Required `.env` variables:
```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
```

Environment config in `src/config/environment.js` validates these and sets dev flags (`useEmulator`, `enableDebug`).
