# McDuck Bank - Comprehensive Codebase Audit

**Date:** 2026-02-12
**Scope:** Security, Architecture, UI, API, Backend, Infrastructure, Notifications
**Severity Levels:** P0 (Critical/Blocker), P1 (High), P2 (Medium), P3 (Low)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Epic 1: Critical Security Vulnerabilities](#epic-1-critical-security-vulnerabilities-p0)
3. [Epic 2: Authentication & Authorization Fixes](#epic-2-authentication--authorization-fixes-p0p1)
4. [Epic 3: User-Facing Bugs - Account Visibility & Balance History](#epic-3-user-facing-bugs---account-visibility--balance-history-p0)
5. [Epic 4: Notification Engine Overhaul](#epic-4-notification-engine-overhaul-p1)
6. [Epic 5: Secrets & Key Management](#epic-5-secrets--key-management-p1)
7. [Epic 6: GCP Infrastructure Hardening](#epic-6-gcp-infrastructure-hardening-p1)
8. [Epic 7: API Layer - Mobile Readiness](#epic-7-api-layer---mobile-readiness-p2)
9. [Epic 8: UI Best Practices & Component Architecture](#epic-8-ui-best-practices--component-architecture-p2)
10. [Epic 9: Backend & Database Improvements](#epic-9-backend--database-improvements-p2)
11. [Epic 10: Code Cleanup & Tech Debt](#epic-10-code-cleanup--tech-debt-p3)
12. [Appendix: File Reference Index](#appendix-file-reference-index)

---

## Executive Summary

This audit covers 154 files across the McDuck Bank React/Firebase banking application. The codebase has a solid foundation with good patterns (Redux Toolkit, unified auth, audit logging, RBAC) but contains **critical security vulnerabilities**, **active bugs preventing users from seeing their data**, a **non-functional notification pipeline**, and significant tech debt from rapid development.

### Critical Findings Count
| Severity | Count | Category |
|----------|-------|----------|
| P0 - Critical | 8 | Security, Data Access Bugs |
| P1 - High | 12 | Auth, Notifications, Secrets |
| P2 - Medium | 14 | Architecture, API, UI |
| P3 - Low | 10 | Cleanup, Tech Debt |

---

## Epic 1: Critical Security Vulnerabilities (P0)

### Story 1.1: SendGrid API Key Exposed in Client Bundle
**Priority:** P0 | **File:** `src/services/sendgridService.js:12`

The SendGrid API key is loaded via `REACT_APP_SENDGRID_API_KEY`. The `REACT_APP_` prefix causes Create React App to embed this value in the production JavaScript bundle, making it visible to any user via browser DevTools or source maps.

```javascript
// VULNERABLE - embedded in client bundle
this.apiKey = process.env.REACT_APP_SENDGRID_API_KEY;
```

**Impact:** Any user can extract the API key and send emails as McDuck Bank, enabling phishing attacks and abuse of the SendGrid account.

**Fix:** Move all email operations to Cloud Functions. Remove `REACT_APP_SENDGRID_API_KEY` from the frontend entirely. The Cloud Function at `functions/index.js` already has `SENDGRID_API_KEY` configured server-side for scheduled statements.

---

### Story 1.2: setupAdmin Cloud Function Has No Authorization Gate
**Priority:** P0 | **File:** `functions/index.js:551-585`

The `setupAdmin` callable function only checks that the caller is authenticated (`request.auth`). It does NOT verify the caller is an existing admin. **Any authenticated user can call this function to grant themselves administrator privileges.**

```javascript
exports.setupAdmin = onCall(async (request) => {
  if (!request.auth) { throw new Error('unauthenticated'); }
  // NO ADMIN CHECK - any authenticated user becomes admin
  await admin.auth().setCustomUserClaims(request.auth.uid, { administrator: true });
});
```

**Impact:** Complete privilege escalation. Any logged-in user can become an admin, access all accounts, create/delete transactions, and view audit logs.

**Fix:** Either remove this function entirely (it's a bootstrap tool), or add a check that the caller already has `administrator: true` in their custom claims, or restrict to a pre-configured admin email list stored in Firestore `system/config`.

---

### Story 1.3: AdminDebugInfo Component Allows Client-Side Admin Escalation
**Priority:** P0 | **File:** `src/components/AdminDebugInfo.js:46-57`

The AdminDebugInfo component directly writes `administrator: true` to the user's Firestore document from the client. While Firestore rules may block this for non-admins, the component imports `getFirestore` dynamically and calls `updateDoc` directly.

```javascript
const userDocRef = doc(db, 'accounts', email);
await updateDoc(userDocRef, {
  administrator: true,
  adminSince: new Date(),
  initialAdmin: true
});
```

**Impact:** Combined with Story 1.2, provides a direct UI for privilege escalation. Even if Firestore rules block it, the component should not exist in production.

**Fix:** Remove `AdminDebugInfo` from production builds entirely. Gate it behind `NODE_ENV === 'development'` or remove it from the component index.

---

### Story 1.4: Base64 "Encryption" for Session Data
**Priority:** P0 | **File:** `src/services/unifiedAuthService.js:139-151`

Session data (including auth tokens and user data) is stored in localStorage using Base64 encoding labeled as "encryption." Base64 is trivially reversible and provides zero security.

```javascript
encryptData(data) {
  const jsonString = JSON.stringify(data);
  return btoa(encodeURIComponent(jsonString)); // NOT encryption
}
```

**Impact:** Auth tokens stored in localStorage are effectively plaintext. XSS or browser extension access can extract full session credentials.

**Fix:** Use the Web Crypto API (`crypto.subtle`) for AES-GCM encryption with a derived key, or better yet, stop storing sensitive tokens client-side and rely on Firebase's built-in token management.

---

### Story 1.5: Firestore Rules Hardcode Admin Email
**Priority:** P0 | **File:** `firestore.rules:12`

The Firestore security rules contain a hardcoded email address as the admin check:

```
function isAdmin() {
  return isAuthenticated() &&
    (request.auth.token.email == 'tony.bailey@gmail.com' ||
     get(/databases/$(database)/documents/accounts/$(request.auth.token.email)).data.administrator == true);
}
```

**Impact:** (1) Single point of failure - if the admin email changes, rules break. (2) The `get()` call on every request adds latency and Firestore read costs. (3) Hardcoded PII in version control.

**Fix:** Use Firebase custom claims exclusively: `request.auth.token.administrator == true`. Remove the hardcoded email. Set claims via a secure Cloud Function with proper authorization.

---

### Story 1.6: Permission Check Allows Privilege Escalation via userData
**Priority:** P0 | **File:** `src/services/apiService.js:46-58`

The `hasPermission()` function checks `userData?.administrator` as a third condition. This means if an attacker can write `administrator: true` to any account document, they gain access to all data through this client-side check.

```javascript
const hasPermission = (authUser, targetUserId, userData = null) => {
  if (!authUser) return false;
  if (authUser.uid === targetUserId) return true;
  if (authUser.administrator || authUser.isAdmin) return true;
  if (userData?.administrator) return true; // DANGEROUS
  return false;
};
```

**Impact:** If any Firestore write path allows setting `administrator: true` on the target document (e.g., through the account update rule), it bypasses permission checks.

**Fix:** Remove the `userData?.administrator` check entirely. Only trust `authUser.administrator` which comes from the authenticated user's session, not from arbitrary document data.

---

### Story 1.7: CORS Configured as Wildcard
**Priority:** P1 | **File:** `functions/index.js:8`

```javascript
const cors = require("cors")({ origin: true }); // Accepts ALL origins
```

**Impact:** Any website can make authenticated requests to the Cloud Functions endpoints.

**Fix:** Restrict to specific allowed origins from the `ALLOWED_ORIGINS` environment variable that's already defined in `functions/.env.example`.

---

### Story 1.8: No CSRF Protection on State-Changing Operations
**Priority:** P1

No CSRF tokens are used anywhere in the application. While Firebase Auth tokens provide some protection, the SPA architecture with direct Firestore writes from the client means any cross-site request that can leverage a stored token could modify data.

**Fix:** Implement CSRF tokens for all Cloud Function callable endpoints. Consider using Firebase App Check to verify requests come from the legitimate app.

---

## Epic 2: Authentication & Authorization Fixes (P0/P1)

### Story 2.1: Account Merge Without User Confirmation
**Priority:** P1 | **File:** `src/services/unifiedAuthService.js:529-582`

When a user logs in with Google OAuth and their email matches an existing account with a different UID, the system automatically merges accounts and migrates all transactions without any user confirmation.

```javascript
if (existingAccount.user_id !== firebaseUser.uid) {
  await this.mergeUserAccounts(existingAccount, firebaseUser);
}
```

**Impact:** If email addresses are reused (rare but possible), one user's financial data could be merged into another user's account. Transaction history could be silently reassigned.

**Fix:** Require explicit user confirmation before merging. Show a dialog explaining that an existing account was found and ask the user to confirm ownership. Add a verification step (e.g., knowledge of last transaction amount).

---

### Story 2.2: Rate Limiting is Client-Side Only
**Priority:** P1 | **File:** `src/services/unifiedAuthService.js:37,177-181`

The rate limiter is implemented in JavaScript and stored in the browser's memory. It can be bypassed by clearing localStorage, using incognito mode, or calling the Firebase Auth API directly.

**Fix:** Implement rate limiting in Cloud Functions or use Firebase Authentication's built-in abuse prevention. Add Cloud Armor or API Gateway rate limiting at the GCP level.

---

### Story 2.3: Admin Status Determined by Multiple Inconsistent Sources
**Priority:** P1 | **Multiple files**

Admin status is checked differently across the codebase:
- Firestore rules: hardcoded email OR `accounts` document field (`firestore.rules:12`)
- Auth service: Firestore field OR Firebase custom claims (`unifiedAuthService.js:677`)
- API service: `authUser.administrator` OR `authUser.isAdmin` (`apiService.js:53`)
- Components: `user?.administrator || user?.isAdmin` (`SimplifiedAccountOverview.js:22`)
- Cloud Functions: `request.auth.token.administrator` only (`functions/index.js:600`)

**Impact:** Inconsistent admin checks can lead to gaps where a user is admin in one context but not another, or conversely, where revoking admin access doesn't propagate everywhere.

**Fix:** Standardize on Firebase custom claims as the single source of truth. Remove the hardcoded email from Firestore rules. Remove `administrator` field checks from client-side code. Always use `token.administrator` from the ID token.

---

### Story 2.4: Audit Log Access Not Gated in Service Layer
**Priority:** P1 | **File:** `src/services/auditService.js`

While Firestore rules restrict audit log reads to admins, the `auditService` functions don't perform client-side permission checks before making queries. If Firestore rules have any gaps, audit data could be exposed.

**Fix:** Add explicit `PermissionService.canViewAuditLogs()` check in the audit service before executing queries.

---

### Story 2.5: ROLE_PERMISSIONS Spread Fails for Admin Role
**Priority:** P2 | **File:** `src/services/permissionService.js:62`

```javascript
const ROLE_PERMISSIONS = {
  [ROLES.USER]: [...],
  [ROLES.ADMIN]: [
    ...ROLE_PERMISSIONS[ROLES.USER] || [], // This evaluates to [] because ADMIN is being defined
```

The spread of `ROLE_PERMISSIONS[ROLES.USER]` inside the `ROLES.ADMIN` definition will be `undefined` (then `[]`) because the object is still being constructed. Admin users don't inherit user permissions.

**Fix:** Define user permissions in a separate constant and spread that into both roles, or restructure the initialization.

---

## Epic 3: User-Facing Bugs - Account Visibility & Balance History (P0)

### Story 3.1: Users Cannot See Their Transaction History / Balance
**Priority:** P0 | **File:** `src/hooks/useAccountData.js:53`

The `useAccountData` hook always passes `user?.uid` to `useTransactions`, ignoring the `targetUserId` which accounts are actually keyed on:

```javascript
const targetUserId = useMemo(() => {
  if (isAdmin && paramUserId) return paramUserId;
  return user?.email || user?.uid; // Email for account lookup
}, [...]);

// BUG: Uses user?.uid, not targetUserId - transactions won't match
const transactions = useTransactions(shouldFetchData ? user?.uid : null, user);
```

The `accounts` collection uses email as document ID, but `transactions` uses `user_id` (Firebase UID). When a user's UID changes (account merge) or when the UID stored in transactions doesn't match the current Firebase UID, **no transactions are returned**.

**Impact:** Users see their profile data but an empty transaction list and $0 balance. This is the balance history bug reported.

**Fix:** After loading user data, extract the `user_id` field from the account document and use that for the transaction query. The flow should be: (1) load account by email -> (2) get `user_id` from account doc -> (3) query transactions by that `user_id`.

---

### Story 3.2: Admin Cannot View Specific User's Transactions via /account/:user_id
**Priority:** P0 | **File:** `src/pages/SimplifiedAccountOverview.js:238`

The admin view subscribes to transactions using `targetUserId` from URL params:

```javascript
const unsubscribeTransactions = subscribeToTransactions(targetUserId, ...);
```

But `targetUserId` from the URL is the account document ID (email), while `subscribeToTransactions` queries `where('user_id', '==', userId)`. Since `user_id` is a Firebase UID and the URL param is an email, this query returns zero results.

**Impact:** Admins clicking on a customer in the admin panel see the user's profile but no transactions.

**Fix:** In `SimplifiedAccountOverview`, after fetching user data, use `userData.user_id` (the actual UID) for the transaction subscription, not the URL parameter.

---

### Story 3.3: Account Merge Doesn't Always Propagate Transaction user_id
**Priority:** P1 | **File:** `src/services/unifiedAuthService.js:587-629`

The `migrateTransactions` function updates `user_id` on existing transactions during an account merge. However, this migration uses `Promise.all` for individual `updateDoc` calls instead of Firestore batch writes. If any individual update fails, the migration is partial - some transactions have the old UID, some have the new UID.

**Impact:** After an account merge, a user may see only some of their transactions, leading to incorrect balance calculations.

**Fix:** Use Firestore `writeBatch()` with proper error handling and rollback. Log the migration results and provide admin tools to verify/retry failed migrations.

---

### Story 3.4: Duplicate Data Fetching on Account Pages
**Priority:** P2 | **File:** `src/pages/SimplifiedAccountOverview.js:191-249`

Two separate `useEffect` hooks both fetch user data: one calls `getUserData` (one-time fetch), and another sets up `subscribeToUserData` (realtime subscription). This causes a race condition where the one-time fetch may overwrite the subscription data, or the user sees a flash of old data.

**Fix:** Use only the realtime subscription. Remove the one-time fetch `useEffect` and rely on the subscription for initial data and updates.

---

## Epic 4: Notification Engine Overhaul (P1)

### Story 4.1: Telegram Notifications Never Fire Automatically
**Priority:** P1 | **Files:** `functions/index.js:921-997`, `src/services/withdrawalTaskService.js`

The `sendTelegramNotification` Cloud Function exists but is only callable manually by admins. The withdrawal task service (`withdrawalTaskService.js`) sends push notifications when withdrawal requests are created/approved/rejected but **never calls the Telegram function**.

```javascript
// withdrawalTaskService.js - only sends push notifications
await serverNotificationService.sendWithdrawalApprovedNotification(...);
// No Telegram notification call anywhere
```

**Impact:** Admin Telegram notifications for new withdrawal requests never fire in production.

**Fix:** Either:
1. Add a Firestore trigger Cloud Function that watches `withdrawal_tasks` and sends Telegram messages when new documents are created, OR
2. Call the `sendTelegramNotification` callable from the withdrawal task service after creating a request, OR
3. Add the Telegram call inside the `scheduledPayInterest` / `scheduledSendStatements` functions for job completion notifications.

---

### Story 4.2: Push Notifications Are Client-Side Simulations Only
**Priority:** P1 | **File:** `src/services/serverNotificationService.js:315-418`

The "server notification service" doesn't actually send server-side push notifications. It uses `simulateServerNotification()` which calls the browser's Service Worker API directly. This only works on the currently active browser tab and device.

```javascript
// Line 303 - admits it's a simulation
return this.simulateServerNotification(activeDevices, notification);

// Lines 399-407 - real implementation is commented out
// const response = await fetch(this.apiEndpoint, { ... });
```

**Impact:** Push notifications only appear on the device/tab where the admin performs the action. Users on other devices never receive notifications. This is why "notifications aren't firing in prod."

**Fix:** Create a Cloud Function endpoint that accepts notification payloads and uses the Firebase Admin SDK's `admin.messaging().send()` to deliver FCM messages to registered device tokens. Replace `simulateServerNotification` with a call to this Cloud Function.

---

### Story 4.3: FCM Token Saved to Wrong Collection
**Priority:** P1 | **File:** `src/services/notificationService.js:101`

```javascript
const userRef = doc(db, 'users', userId); // 'users' collection doesn't exist!
```

The notification service saves FCM tokens to a `users` collection, but the app uses `accounts` as the user collection. There are no Firestore rules for a `users` collection, so this write likely fails silently.

Meanwhile, `serverNotificationService.js` reads device tokens from `accounts.notifications.devices`.

**Impact:** FCM tokens are saved to the wrong place and never retrieved, so push notifications have no tokens to send to.

**Fix:** Change to `doc(db, 'accounts', userId)` or use the `serverNotificationService.registerDevice()` method which correctly writes to the `accounts` collection.

---

### Story 4.4: Email Notification Templates Hard to Update
**Priority:** P2 | **Multiple files**

Email templates exist in 5+ locations:
- `public/email_alert.html`
- `public/email_statement.html`
- `public/email_statement_template.html`
- `src/templates/email_alert.html`
- `src/templates/email_statement.html`
- `src/emails/StatementEmail.jsx` (React component)
- Hardcoded fallback in `functions/index.js:227-414` (250 lines of inline HTML)
- `sendgridService.js` stores templates in localStorage

**Impact:** Updating an email template requires changes in multiple locations. The Cloud Function has a 250-line fallback template that may differ from the public one. There's no single source of truth.

**Fix:** Consolidate to a single template source:
1. Store templates in Firestore `system/email_templates` collection
2. Cloud Functions read from Firestore (not HTTP fetch from the public site)
3. Admin UI edits templates in Firestore
4. Remove all duplicate template files and the inline fallback

---

### Story 4.5: scheduledSendStatements Calls Undefined Function
**Priority:** P1 | **File:** `functions/index.js:875,1021-1043`

The `scheduledSendStatements` function calls `createAndSendStatement(userId, userEmail)` which expects a `userId` string and `userEmail` string. But the `createAndSendStatement` helper at line 1021 calls `createMonthlyStatement(userId, startOfMonth, endOfMonth)` passing Date objects where the function expects `(account, transactions, year, month)`.

```javascript
// Called with: createAndSendStatement(userId, userEmail)
const createAndSendStatement = async (userId, userEmail) => {
  const statement = await createMonthlyStatement(userId, startOfMonth, endOfMonth);
  // But createMonthlyStatement expects (account, transactions, year, month)
  // This will fail at runtime
```

**Impact:** The scheduled monthly statement function crashes every time it runs. Statements are only successfully sent via the manual `sendStatements` callable function.

**Fix:** Fix the `createAndSendStatement` helper to properly fetch the account document, fetch transactions for the period, and pass the correct arguments to `createMonthlyStatement`.

---

## Epic 5: Secrets & Key Management (P1)

### Story 5.1: Firebase Config in Client Code
**Priority:** P2 | **File:** `src/config/environment.js`, `cloudbuild.yaml`

Firebase client config (API key, project ID, etc.) is embedded in the client bundle via `REACT_APP_` environment variables. While this is Firebase's intended design (these are public keys), the `cloudbuild.yaml` uses Cloud Build substitution variables which may expose them in build logs.

**Fix:** Ensure Cloud Build substitution variables are marked as secrets. Use Firebase App Check to restrict API key usage to the legitimate app domain.

---

### Story 5.2: VAPID Key Hardcoded in Source
**Priority:** P2 | **File:** `src/services/notificationService.js:9`

The FCM VAPID key is hardcoded directly in the source file. While VAPID keys are designed to be public, hardcoding makes rotation difficult.

**Fix:** Move to an environment variable (`REACT_APP_FIREBASE_VAPID_KEY`). The `scripts/generate-service-worker.js` already handles environment variable substitution for the service worker template.

---

### Story 5.3: Cloud Functions Environment Variables Not Using Secret Manager
**Priority:** P1 | **Files:** `functions/.env.example`, `terraform/main.tf`

Terraform defines Secret Manager secrets for Firebase config, but the Cloud Functions rely on `.env` files or `firebase functions:config:set`. Sensitive values like `SENDGRID_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TWILIO_AUTH_TOKEN` should be in Secret Manager with IAM-scoped access.

**Fix:** Use `defineSecret()` from `firebase-functions/params` to reference Secret Manager secrets in Cloud Functions v2. Update Terraform to create secrets for all sensitive values. Remove `.env` files from production deployment.

---

### Story 5.4: Self-Signed Certificate Embedded in Script
**Priority:** P3 | **File:** `scripts/serve-https.js`

A self-signed TLS certificate (PEM-encoded private key and certificate) is hardcoded in the HTTPS development server script. This is for local development only but should not be in the repository.

**Fix:** Generate certificates at dev-setup time instead of embedding them. Add the generation to `scripts/dev-setup.sh`.

---

## Epic 6: GCP Infrastructure Hardening (P1)

### Story 6.1: App Engine + Firebase Hosting Dual Deployment
**Priority:** P1 | **Files:** `app.yaml`, `firebase.json`

The application is configured for both App Engine (`app.yaml`) and Firebase Hosting (`firebase.json` with `hosting.public: "build"`). This creates confusion about which is the production deployment target and may result in inconsistent deployments.

**Fix:** Choose one deployment target:
- **Firebase Hosting** for the SPA (simpler, built-in CDN, automatic SSL)
- **App Engine** only if server-side rendering or custom server logic is needed
Remove the unused configuration. Update `cloudbuild.yaml` and `scripts/deploy.sh` accordingly.

---

### Story 6.2: Cloud Scheduler Jobs Not Managed as Infrastructure
**Priority:** P2 | **Files:** `functions/index.js:771-915`, `SCHEDULER_SETUP.md`

Scheduled functions are defined in code (`onSchedule`) but the Cloud Scheduler jobs themselves need to be created via `gcloud` or the Firebase CLI. If the scheduled functions are deployed but the Scheduler jobs aren't created, nothing runs.

**Fix:** Add Cloud Scheduler job creation to Terraform (`terraform/main.tf`). Define `google_cloud_scheduler_job` resources for `scheduledPayInterest` and `scheduledSendStatements`. Add health checks that alert if scheduled jobs haven't run.

---

### Story 6.3: No Monitoring or Alerting
**Priority:** P1

The Terraform config enables Monitoring, Logging, and Error Reporting APIs but doesn't create any alert policies, uptime checks, or dashboards. The `healthCheck` endpoint exists but isn't monitored.

**Fix:** Add:
- Uptime check for the health endpoint
- Alert policy for Cloud Function errors
- Alert policy for Firestore security rule denials
- Dashboard for key metrics (active users, transaction volume, function execution times)
- Log-based alerts for security events

---

### Story 6.4: VPC Connector Referenced but Not Created
**Priority:** P2 | **File:** `app.yaml:10`

```yaml
# vpc_access_connector:
#   name: projects/PROJECT_ID/locations/REGION/connectors/CONNECTOR_NAME
```

The VPC connector configuration is commented out. Without it, App Engine communicates with GCP services over public internet instead of private networking.

**Fix:** Create a VPC connector in Terraform and enable it in `app.yaml`. This is required for private Firestore access if using VPC Service Controls.

---

### Story 6.5: No Disaster Recovery or Backup Strategy
**Priority:** P2

No Firestore backup schedule, no point-in-time recovery configuration, and no documented disaster recovery plan.

**Fix:** Enable Firestore point-in-time recovery. Create scheduled Firestore exports to Cloud Storage. Document RTO/RPO targets and recovery procedures.

---

## Epic 7: API Layer - Mobile Readiness (P2)

### Story 7.1: No REST API Layer
**Priority:** P2 | **Files:** `src/services/*.js`

All data operations go directly from the React client to Firestore via the Firebase JS SDK. There is no REST API or GraphQL endpoint. A mobile app would need to either:
1. Use the Firebase mobile SDKs (duplicating all business logic), or
2. Have a shared API layer

**Fix:** Create Cloud Function HTTP endpoints for key operations:
- `GET /api/account` - Get current user's account
- `GET /api/transactions` - Get user's transactions (with pagination)
- `POST /api/withdrawal-request` - Create withdrawal request
- `GET /api/withdrawal-requests` - List withdrawal requests
- Admin endpoints with proper auth

This creates a single API that both web and mobile can consume.

---

### Story 7.2: Business Logic Scattered Across Client Components
**Priority:** P2 | **Files:** `src/pages/AdminPanel.js:330-469`, `src/pages/AccountOverview.js:24-175`

Transaction creation, editing, deletion, and house deposit logic is implemented directly in page components. The `AdminPanel.js` file alone has 200+ lines of business logic for creating transactions, creating withdrawal requests, and managing house deposits.

**Impact:** This logic must be duplicated for any additional client (mobile app, admin CLI, etc.).

**Fix:** Extract all business logic into the service layer. Page components should only call service methods and handle UI state. Create:
- `transactionService.createTransaction(data, user)`
- `transactionService.editTransaction(id, data, user)`
- `transactionService.deleteTransaction(id, user)`
Each should handle audit logging, house deposits, and notifications internally.

---

### Story 7.3: Pagination Implementation is Inefficient
**Priority:** P2 | **File:** `src/services/apiService.js:312-403`

The pagination implementation for pages > 0 fetches all documents up to the offset:

```javascript
if (page > 0) {
  const offsetQuery = query(..., limit(offset + pageSize + 1));
  const offsetSnapshot = await getDocs(offsetQuery);
  const currentPageDocs = allDocs.slice(startIndex, endIndex + 1);
}
```

**Impact:** Page 10 with pageSize 20 fetches 201 documents to display 20. This gets worse as users paginate deeper. Firestore charges per document read.

**Fix:** Implement cursor-based pagination using `startAfter()` with the last document from the previous page. Store cursor references in component state.

---

## Epic 8: UI Best Practices & Component Architecture (P2)

### Story 8.1: Duplicated Account Overview Pages
**Priority:** P2 | **Files:** `src/pages/AccountOverview.js`, `src/pages/SimplifiedAccountOverview.js`

Two nearly identical page components exist:
- `AccountOverview.js` (266 lines) - uses `useAccountData` hook, handles own account view
- `SimplifiedAccountOverview.js` (307 lines) - uses direct service calls, handles admin view of specific user

Both render the same UI (`UserProfileCard`, `AccountSummaryCards`, `PaginatedTransactionTable`) with identical transaction edit/delete handlers (copy-pasted 150+ lines).

**Fix:** Merge into a single `AccountOverview` component that handles both cases based on URL params and user role. Extract transaction edit/delete logic into a custom hook or service method.

---

### Story 8.2: No Shared Layout Component
**Priority:** P3 | **File:** `src/App.js:52`

Every page manually manages top padding for the navbar and bottom padding for the bottom nav:

```javascript
<div style={{ paddingTop: isAuthenticated ? '64px' : '0', paddingBottom: isAuthenticated ? '80px' : '0' }}>
```

**Fix:** Create a `Layout` component that wraps authenticated pages with proper padding, navbar, and bottom nav. Unauthenticated pages use a separate `AuthLayout`.

---

### Story 8.3: Missing Loading/Error State Components
**Priority:** P3 | **Multiple files**

Loading and error states are implemented inconsistently:
- `AccountOverview.js`: Full container with CircularProgress + Typography
- `SimplifiedAccountOverview.js`: Bare `<CircularProgress />`
- `AdminPanel.js`: Full container with CircularProgress + Typography + retry button
- Various other patterns across pages

**Fix:** Create shared `<LoadingState />` and `<ErrorState />` components with consistent styling and retry functionality.

---

### Story 8.4: Form Components Not Reusable
**Priority:** P2 | **Files:** `src/components/TransactionForm.js`, `src/components/SimpleWithdrawalForm.js`

`SimpleWithdrawalForm.js` uses `alert()` for form submission feedback:
```javascript
alert('Request submitted: $${amount} - ${note}');
```

The withdrawal form exists in two versions (`SimpleWithdrawalForm.js` and the full withdrawal page) with different implementations.

**Fix:** Create a single configurable form component with proper feedback (snackbar/toast notifications instead of `alert()`). Remove `SimpleWithdrawalForm.js`.

---

### Story 8.5: Deprecated userService.js Still Imported
**Priority:** P2 | **Files:** `src/services/userService.js`, `src/hooks/useTransactions.js:2`, `src/pages/SimplifiedAccountOverview.js:5`

`userService.js` is marked deprecated but is still actively imported:
- `useTransactions.js` imports `subscribeToTransactions` from userService
- `SimplifiedAccountOverview.js` imports `getUserData`, `subscribeToUserData`, `subscribeToTransactions`

The deprecated service wraps `apiService` but the wrapper changes the return format (unwrapping `result.data`), creating subtle behavioral differences.

**Fix:** Complete the migration. Update all imports to use `apiService` directly. Remove `userService.js`.

---

## Epic 9: Backend & Database Improvements (P2)

### Story 9.1: Firestore Document ID Inconsistency
**Priority:** P1 | **Multiple files**

Account documents use email addresses as document IDs, but transactions use Firebase UIDs in the `user_id` field. This creates a fundamental mismatch:
- Account lookup: by email (document ID)
- Transaction lookup: by Firebase UID (`user_id` field)
- URL routing: by email or UID depending on context

**Impact:** This is the root cause of the account visibility and balance history bugs (Epic 3).

**Fix:** Standardize the document ID strategy:
- Short-term: Ensure every account document has a consistent `user_id` field matching the current Firebase UID, and always use that for transaction queries
- Long-term: Consider migrating account document IDs to Firebase UIDs for consistency

---

### Story 9.2: No Transaction Atomicity
**Priority:** P1 | **Files:** `src/pages/AdminPanel.js:363-468`, `src/services/withdrawalTaskService.js:237-321`

Transaction creation, house deposit creation, notification sending, and audit logging are performed as separate operations without Firestore transactions/batches. If the house deposit fails after the withdrawal succeeds, the system is in an inconsistent state.

```javascript
// AdminPanel.js - no atomicity
const docRef = await addDoc(transactionRef, { ... });  // Step 1: Create transaction
await withdrawalDepositService.createHouseDeposit(...); // Step 2: May fail
await serverNotificationService.sendDepositNotification(...); // Step 3: May fail
await auditService.logTransactionEvent(...); // Step 4: May fail
```

**Fix:** Use Firestore `writeBatch()` or `runTransaction()` for related writes. Make non-critical operations (notifications, audit logging) fire-and-forget with error logging, but ensure financial writes are atomic.

---

### Story 9.3: Balance Calculated on Every Request
**Priority:** P2 | **Files:** `functions/index.js:57-138`, `src/services/apiService.js:480-531`

Account balance is computed by summing all transactions every time it's needed. The Cloud Functions cache it for 24 hours, but the client recalculates from scratch on every page load.

**Fix:** Maintain a running balance on the account document. Update it atomically when transactions are created/modified/deleted using Firestore transactions. The 24-hour cache in Cloud Functions is a good fallback but shouldn't be the primary mechanism.

---

### Story 9.4: Missing Firestore Indexes for Common Queries
**Priority:** P2 | **File:** `firestore.indexes.json`

The existing indexes cover basic transaction and withdrawal queries, but there are no indexes for:
- Audit logs filtered by user + date range
- Security events by type + date
- Notifications by user + read status

**Fix:** Add composite indexes for all query patterns used in the admin panel and audit log viewer.

---

## Epic 10: Code Cleanup & Tech Debt (P3)

### Story 10.1: Remove Debug Console Logging (165+ statements)
**Priority:** P3 | **Multiple files**

There are 165+ `console.log` statements across the codebase, including sensitive data logging:

Key offenders:
- `src/hooks/useAccountData.js:129-140` - Logs all user data on every render
- `src/hooks/useTransactions.js:16,28` - Logs transaction data
- `src/pages/SimplifiedAccountOverview.js:255-262` - Logs user data, UID, admin status
- `src/services/serverNotificationService.js` - 20+ log statements including token fragments
- `src/store/slices/authSlice.js` - 9 log statements including auth state

**Fix:** Replace all `console.log` with the existing `secureLog` utility from `src/utils/security.js` which respects environment settings. Remove debug-specific logging entirely. Keep only `secureLog('error', ...)` for genuine errors.

---

### Story 10.2: Remove Backup and Leftover Files
**Priority:** P3

Files to remove:
- `src/store/slices/authSlice.js.backup` - Old auth slice backup
- `src/hooks/useAccountData.js.fixed` - Fixed version not integrated
- `code/` directory - Unused Firebase Functions boilerplate
- `repo/` directory - Unused Firebase Functions boilerplate
- `functions/test-sms.js` - Standalone test file
- `functions/cleanup-wrong-accounts.js` - One-time cleanup script with hardcoded document IDs

---

### Story 10.3: Remove Test Cloud Functions from Production
**Priority:** P2 | **File:** `functions/index.js:999-1018`

The `testSMS` Cloud Function is deployed to production. It serves no purpose and increases the attack surface.

```javascript
exports.testSMS = onCall(async (request) => {
  console.log('Test SMS function called successfully');
  return { success: true, message: 'Test SMS function works!', data: request.data };
});
```

**Fix:** Remove `testSMS` from `functions/index.js`. Move to a separate test file that's not deployed.

---

### Story 10.4: Remove alert() Calls
**Priority:** P3 | **4 instances**

Replace `alert()` calls with proper UI feedback:
- `src/components/SimpleWithdrawalForm.js:13`
- `src/pages/DemoDashboard.js:87`
- `src/pages/AdminPanel.js:218`
- `src/hooks/usePWA.js:61`

**Fix:** Use MUI Snackbar/Alert components for user feedback.

---

### Story 10.5: Remove Duplicate Email Template Files
**Priority:** P3 | **Multiple files**

Email templates exist in 5+ locations (documented in Story 4.4). Remove all duplicates and consolidate.

Files to remove after consolidation:
- `public/email_alert.html`
- `public/email_statement.html`
- `src/templates/email_alert.html`
- `src/templates/email_statement.html`

Keep only `public/email_statement_template.html` as the canonical template and the fallback in `functions/index.js`.

---

### Story 10.6: Address TODO Comments
**Priority:** P3

1. `functions/index.js:495` - `// TODO: Calculate from withdrawal_tasks if needed`
2. `src/components/ErrorBoundary.js:28` - `// TODO: Send to error tracking service`

**Fix:** Implement pending withdrawal calculation from `withdrawal_tasks` collection. Integrate an error tracking service (Sentry recommended for React apps).

---

### Story 10.7: Clean Up Deprecated Service Migration
**Priority:** P2

Complete the `userService.js` -> `apiService.js` migration:
1. Update all imports of `userService` to use `apiService`
2. Remove `userService.js`
3. Update the `useTransactions` hook to use `apiService.subscribeToTransactions`
4. Update `SimplifiedAccountOverview` to use `apiService` directly

---

## Appendix: File Reference Index

### Critical Files (Require Immediate Attention)
| File | Issues |
|------|--------|
| `functions/index.js` | Stories 1.2, 1.7, 4.1, 4.5, 10.3 |
| `src/services/unifiedAuthService.js` | Stories 1.4, 2.1, 2.2, 3.3 |
| `src/services/sendgridService.js` | Story 1.1 |
| `src/services/apiService.js` | Stories 1.6, 7.3, 9.3 |
| `src/hooks/useAccountData.js` | Story 3.1 |
| `src/pages/SimplifiedAccountOverview.js` | Stories 3.2, 3.4 |
| `firestore.rules` | Story 1.5 |
| `src/components/AdminDebugInfo.js` | Story 1.3 |
| `src/services/serverNotificationService.js` | Story 4.2 |
| `src/services/notificationService.js` | Story 4.3 |
| `src/services/permissionService.js` | Story 2.5 |

### Architecture Diagrams Needed
- Authentication flow (current vs. proposed)
- Notification pipeline (current broken state vs. target)
- Data model (accounts, transactions, withdrawal_tasks relationships)
- Deployment topology (App Engine vs. Firebase Hosting decision)

---

## Recommended Implementation Order

### Sprint 1 (Blockers & Security)
1. Story 1.2 - Remove/secure setupAdmin function
2. Story 1.3 - Remove AdminDebugInfo from production
3. Story 1.1 - Move SendGrid to Cloud Functions
4. Story 1.5 - Fix Firestore rules (remove hardcoded email)
5. Story 1.6 - Fix hasPermission privilege escalation
6. Story 3.1 - Fix user transaction visibility bug
7. Story 3.2 - Fix admin user transaction visibility

### Sprint 2 (Auth & Notifications)
1. Story 2.3 - Standardize admin checks
2. Story 4.1 - Wire up Telegram notifications
3. Story 4.2 - Implement real push notifications via Cloud Functions
4. Story 4.3 - Fix FCM token collection
5. Story 4.5 - Fix scheduled statement function

### Sprint 3 (Infrastructure & API)
1. Story 6.1 - Resolve App Engine vs Firebase Hosting
2. Story 6.3 - Set up monitoring and alerting
3. Story 5.3 - Migrate to Secret Manager
4. Story 7.1 - Create REST API endpoints
5. Story 9.2 - Add transaction atomicity

### Sprint 4 (UI & Cleanup)
1. Story 8.1 - Merge duplicate account pages
2. Story 8.5 - Complete userService migration
3. Story 10.1 - Remove debug logging
4. Story 10.2 - Remove backup files
5. Story 10.3 - Remove test Cloud Functions
