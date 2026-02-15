# Audit Fix & Test Implementation Plan

**Branch:** `audit-fixes-and-tests`
**Base:** `main` @ `2ea30de4`
**Created:** 2026-02-14

This plan addresses findings from `CODEBASE_AUDIT.md` and the supplementary review of new/modified files. Changes are grouped into mergeable commits with test checkpoints between each phase.

---

## Phase 1: Critical Security Fixes

These must land first -- they represent active vulnerabilities in a banking application.

### 1.1 Remove/secure setupAdmin Cloud Function
**Source:** CODEBASE_AUDIT Story 1.2
**File:** `functions/index.js:551-585`
**Fix:** Add check that caller already has `administrator: true` custom claim, OR restrict to a pre-configured allow-list in Firestore `system/config`. For now, gate it behind existing admin claim since the bootstrap use-case is complete.
**Test:** Unit test for the Cloud Function verifying non-admin callers are rejected.

### 1.2 Remove AdminDebugInfo from production
**Source:** CODEBASE_AUDIT Story 1.3
**File:** `src/components/AdminDebugInfo.js`
**Fix:** Gate behind `process.env.NODE_ENV === 'development'` check in the component, and remove from any production page imports. The component writes `administrator: true` directly to Firestore from the client.
**Test:** Verify component renders nothing in production mode.

### 1.3 Fix hasPermission privilege escalation
**Source:** CODEBASE_AUDIT Story 1.6
**File:** `src/services/apiService.js:46-58`
**Fix:** Remove `if (userData?.administrator) return true` -- only trust auth session data, not arbitrary Firestore document fields.
**Test:** Unit test for `hasPermission` verifying `userData.administrator` does not grant access.

### 1.4 Fix Firestore rules -- remove hardcoded email
**Source:** CODEBASE_AUDIT Story 1.5
**File:** `firestore.rules:12`
**Fix:** Replace hardcoded email check with `request.auth.token.administrator == true` using custom claims only.
**Test:** Manual verification against emulator.

### 1.5 Move SendGrid operations to Cloud Functions
**Source:** CODEBASE_AUDIT Story 1.1
**File:** `src/services/sendgridService.js`
**Fix:** The `REACT_APP_SENDGRID_API_KEY` is embedded in the client bundle. Remove the client-side SendGrid service. All email sending should go through existing Cloud Functions. Mark `sendgridService.js` as deprecated with a warning, redirect calls to `adminCloudFunctions.sendEmail()`.
**Test:** Verify no `REACT_APP_SENDGRID_API_KEY` references in built output.

### 1.6 Fix Base64 "encryption" for session data
**Source:** CODEBASE_AUDIT Story 1.4
**File:** `src/services/unifiedAuthService.js:139-151`
**Fix:** Replace `btoa`/`atob` with Web Crypto API AES-GCM encryption, or remove custom encryption entirely and rely on Firebase's built-in token management. Simplest safe approach: stop storing sensitive tokens in localStorage -- only store non-sensitive user display data.
**Test:** Unit test verifying stored data is not trivially decodable.

### 1.7 Restrict CORS on Cloud Functions
**Source:** CODEBASE_AUDIT Story 1.7
**File:** `functions/index.js:8`
**Fix:** Replace `cors({ origin: true })` with explicit allowed origins from environment config.
**Test:** Verify CORS rejects unknown origins.

**Checkpoint: `git commit` -- "Fix critical security vulnerabilities (P0)"**
**Manual test:** Run app, verify login/admin/transactions still work. Run `npm test`.

---

## Phase 2: Authorization & Data Access Fixes

### 2.1 Add ownership check to cancelWithdrawalRequest
**Source:** Supplementary audit C2
**File:** `src/services/withdrawalTaskService.js:223`
**Fix:** Read task doc before update, verify `user.uid === taskData.user_id`. Reject if not owner.
**Test:** Unit test: non-owner cancellation is rejected.

### 2.2 Add status guards to approve/reject
**Source:** Supplementary audit C2, CODEBASE_AUDIT Story 9.2
**File:** `src/services/withdrawalTaskService.js:256,345`
**Fix:** Check `taskData.status === 'pending'` before processing. Use Firestore transaction for atomicity on approve (read task + create transaction + update task in single transaction).
**Test:** Unit test: approving an already-approved request fails. Test: concurrent approve calls don't double-process.

### 2.3 Add amount validation in service layer
**Source:** Supplementary audit C1
**File:** `src/services/withdrawalTaskService.js:33`
**Fix:** Validate `typeof amount === 'number'`, `!isNaN(amount)`, `amount > 0`, `isFinite(amount)`. Return `{ success: false }` on invalid.
**Test:** Unit tests for NaN, negative, zero, Infinity, string inputs.

### 2.4 Fix duplicate addDoc import
**Source:** Supplementary audit H3
**File:** `src/services/withdrawalTaskService.js:4,18`
**Fix:** Remove line 18 (`import { addDoc as addTransactionDoc }`), use `addDoc` throughout.
**Test:** Existing tests pass.

### 2.5 Fix UID/email inconsistency in notificationPreferencesService
**Source:** Supplementary audit H4
**File:** `src/services/notificationPreferencesService.js`
**Fix:** All methods must use `findUserAccount()` to resolve the correct document ref. Remove direct `doc(db, 'accounts', userId)` calls from `setPreferences`, `updateEventPreferences`, `updateChannelSettings`, `setGlobalEnabled`.
**Test:** Unit test: preferences save to correct doc when userId is UID vs email.

### 2.6 Replace __name__ queries with direct getDoc
**Source:** Supplementary audit H5
**File:** `src/services/withdrawalTaskService.js:261,350`
**Fix:** Use `getDoc(doc(this.tasksCollection, taskId))` instead of `getDocs(query(..., where('__name__', '==', taskId)))`.
**Test:** Existing tests pass, verify behavior unchanged.

### 2.7 Fix ROLE_PERMISSIONS spread failure
**Source:** CODEBASE_AUDIT Story 2.5
**File:** `src/services/permissionService.js:62`
**Fix:** Define user permissions in a separate const, then spread into both roles.
**Test:** Unit test: admin role includes all user permissions.

**Checkpoint: `git commit` -- "Fix authorization, validation, and data access bugs"**
**Manual test:** Create/cancel/approve/reject withdrawal requests. Verify permissions.

---

## Phase 3: User-Facing Data Visibility Fixes

### 3.1 Fix user transaction visibility
**Source:** CODEBASE_AUDIT Story 3.1
**File:** `src/hooks/useAccountData.js:53`
**Fix:** After loading account data, extract `user_id` from account doc and use that for transaction query (not `user?.uid` directly).
**Test:** Integration test: user sees their transactions when account.user_id differs from Firebase UID.

### 3.2 Fix admin user transaction visibility
**Source:** CODEBASE_AUDIT Story 3.2
**File:** `src/pages/SimplifiedAccountOverview.js:238`
**Fix:** After fetching user data, use `userData.user_id` (the UID) for transaction subscription, not the URL email param.
**Test:** Integration test: admin viewing `/account/user@email.com` sees transactions.

### 3.3 Remove duplicate data fetching
**Source:** CODEBASE_AUDIT Story 3.4
**File:** `src/pages/SimplifiedAccountOverview.js:191-249`
**Fix:** Remove one-time fetch useEffect, rely on realtime subscription only.
**Test:** Verify no duplicate network calls.

**Checkpoint: `git commit` -- "Fix user and admin transaction visibility bugs"**
**Manual test:** Log in as user, verify balance and transactions display. Log in as admin, view user accounts.

---

## Phase 4: Notification Pipeline Fixes

### 4.1 Fix FCM token saved to wrong collection
**Source:** CODEBASE_AUDIT Story 4.3
**File:** `src/services/notificationService.js:101`
**Fix:** Change `doc(db, 'users', userId)` to `doc(db, 'accounts', userId)`.
**Test:** Unit test: FCM token saved to accounts collection.

### 4.2 Fix broken testSMS reference in TelegramTestPanel
**Source:** Supplementary audit H2
**File:** `src/components/TelegramTestPanel.js:88`
**Fix:** Remove the "Test Minimal Function" button or wire it to an actual function. Replace `alert()` with MUI Alert.
**Test:** Component test: all buttons call valid functions.

### 4.3 Remove dead notification code
**Source:** Supplementary audit M3/M4
**Files:** `src/services/smsService.js`, `src/services/notificationPreferencesService.js`
**Fix:** Since neither is imported anywhere, mark with clear "NOT YET INTEGRATED" header comments. Don't delete since they're scaffolding for the notification config plan.
**Test:** N/A.

### 4.4 Use serverTimestamp() in notification preferences
**Source:** Supplementary audit L3
**File:** `src/services/notificationPreferencesService.js`
**Fix:** Replace all `new Date()` with `serverTimestamp()` for Firestore writes.
**Test:** Unit test: verify serverTimestamp used in writes.

### 4.5 Prevent setPreferences from creating incomplete account docs
**Source:** Supplementary audit M5
**File:** `src/services/notificationPreferencesService.js:87-96`
**Fix:** If account doc doesn't exist, return error instead of creating a skeleton doc.
**Test:** Unit test: setPreferences on non-existent account returns error.

**Checkpoint: `git commit` -- "Fix notification pipeline and clean up dead code"**
**Manual test:** Test Telegram panel sends messages. Verify FCM token registration.

---

## Phase 5: Code Cleanup & Consistency

### 5.1 Standardize error handling in withdrawalTaskService
**Source:** Supplementary audit M1
**Fix:** All methods return `{ success, error, code }` objects. Remove `throw new Error()` pattern, wrap in return objects.
**Test:** Unit tests verify all methods return consistent shape.

### 5.2 Remove sensitive data from console logs
**Source:** CODEBASE_AUDIT Story 10.1, Supplementary audit H1
**Files:** All new/modified service files
**Fix:** Replace `console.log` in services with the existing `secureLog` utility from `src/utils/security.js`. Remove PII from log messages (emails, amounts, user objects).
**Test:** Grep for `console.log` in service files returns zero.

### 5.3 Remove test Cloud Function from production
**Source:** CODEBASE_AUDIT Story 10.3
**File:** `functions/index.js:999-1018`
**Fix:** Remove `testSMS` export.
**Test:** Verify functions deploy without it.

### 5.4 Remove backup/leftover files
**Source:** CODEBASE_AUDIT Story 10.2
**Files:** `src/store/slices/authSlice.js.backup`, `src/hooks/useAccountData.js.fixed`, `functions/test-sms.js`, `functions/cleanup-wrong-accounts.js`
**Fix:** Delete these files.
**Test:** App builds cleanly.

### 5.5 Replace alert() calls with MUI Snackbar
**Source:** CODEBASE_AUDIT Story 10.4
**Files:** `SimpleWithdrawalForm.js`, `DemoDashboard.js`, `AdminPanel.js`, `usePWA.js`
**Fix:** Replace `alert()` with MUI Snackbar/Alert pattern.
**Test:** Component tests verify no alert() usage.

**Checkpoint: `git commit` -- "Code cleanup, consistent error handling, remove dead code"**
**Manual test:** Full regression -- login, view account, create withdrawal, admin approve, admin panel.

---

## Phase 6: Test Infrastructure Setup

Build proper test foundations before writing feature tests.

### 6.1 Configure MSW for API mocking
**Files:** Create `src/mocks/handlers.js`, `src/mocks/server.js`
**What:** Set up MSW v2 handlers for Cloud Function callable endpoints. Wire into setupTests.js.
**Test:** MSW intercepts a sample request in a test.

### 6.2 Improve Firebase mock
**File:** `src/__mocks__/firebase.js`
**What:** Add error simulation capabilities. Currently all ops always succeed -- add ability to make specific calls fail. Add mock data factories.
**Test:** A test can trigger a Firebase error and assert error handling.

### 6.3 Create test data factories
**File:** Create `src/utils/test-factories.js`
**What:** Factory functions for creating mock users, transactions, withdrawal requests, accounts with realistic data. Reduce duplication across test files.
**Test:** Factories produce valid objects.

### 6.4 Fix test-utils.js exports
**File:** `src/utils/test-utils.js`
**What:** Verify `createTestStore` is properly exported. Fix render wrapper to include all providers.
**Test:** Custom render works with all provider context.

**Checkpoint: `git commit` -- "Set up test infrastructure: MSW, factories, improved mocks"**
**Manual test:** `npm test` passes.

---

## Phase 7: Service Layer Tests

### 7.1 withdrawalTaskService tests
**File:** Create `src/services/__tests__/withdrawalTaskService.test.js`
**Coverage:**
- createWithdrawalRequest: valid request, invalid amount (NaN/negative/zero/Infinity), missing user
- cancelWithdrawalRequest: owner cancels, non-owner rejected, non-pending rejected
- approveWithdrawalRequest: valid approval creates transaction, already-approved rejected, task not found
- rejectWithdrawalRequest: valid rejection, already-rejected rejected, rejection reason stored
- getUserWithdrawalRequests: returns user's requests, filters by status
- getAllWithdrawalRequests: returns all, filters by status
- archiveCompletedRequests: archives old requests, respects cutoff date

### 7.2 adminCloudFunctions tests
**File:** Create `src/services/__tests__/adminCloudFunctions.test.js`
**Coverage:**
- calculateInterest: success response, auth error, permission error
- sendMonthlyStatements: with/without options, error handling
- sendEmail: valid payload, missing fields
- sendTelegram: valid message, empty message rejected
- Lazy initialization: callable created only once
- getErrorMessage: maps all error codes correctly

### 7.3 permissionService tests
**File:** Create `src/services/__tests__/permissionService.test.js`
**Coverage:**
- ROLE_PERMISSIONS: admin inherits user permissions
- hasPermission: checks for each permission type
- canAccessResource: admin vs user vs unauthenticated

### 7.4 apiService tests (hasPermission function)
**File:** Create `src/services/__tests__/apiService.test.js`
**Coverage:**
- hasPermission: own data allowed, admin allowed, non-admin other-user rejected
- hasPermission: userData.administrator does NOT grant access (security fix verification)

### 7.5 notificationPreferencesService tests
**File:** Create `src/services/__tests__/notificationPreferencesService.test.js`
**Coverage:**
- getPreferences: returns defaults when none exist, returns stored preferences
- setPreferences: saves to correct account doc, refuses to create new account
- updateEventPreferences: updates single event channels
- shouldSendNotification: checks global enable, channel enable, event enable, fails closed on error
- findUserAccount: finds by email (doc ID), finds by user_id field, handles not found

### 7.6 auditService tests
**File:** Create `src/services/__tests__/auditService.test.js`
**Coverage:**
- logTransactionEvent: creates audit log document with correct fields
- Event types: all AUDIT_EVENTS produce valid log entries

**Checkpoint: `git commit` -- "Add service layer unit tests"**
**Run:** `npm test -- --coverage` -- check coverage numbers.

---

## Phase 8: Component & Integration Tests

### 8.1 TelegramTestPanel tests
**File:** Create `src/components/__tests__/TelegramTestPanel.test.js`
**Coverage:**
- Renders test and custom message UI
- Send test Telegram button calls adminCloudFunctions.sendTelegram
- Custom message validates non-empty
- Success/error states display correctly
- Loading state disables buttons

### 8.2 NotificationSettings tests
**File:** Create `src/components/__tests__/NotificationSettings.test.js`
**Coverage:**
- Renders notification channel options
- Toggle channels on/off
- Save preferences calls service

### 8.3 Page-level integration tests
**File:** Expand `src/__tests__/integration/`
**Coverage:**
- Withdrawal flow: create request -> admin approves -> transaction created -> balance updated
- Withdrawal rejection: create request -> admin rejects -> reason displayed to user
- Cancel withdrawal: user cancels own pending request
- Admin cannot double-approve

### 8.4 Auth flow hardening tests
**File:** Expand `src/__tests__/integration/authentication.test.js`
**Coverage:**
- Non-admin cannot access admin routes (existing, verify)
- Admin claim propagation
- Session timeout handling
- Rate limiting behavior

**Checkpoint: `git commit` -- "Add component and integration tests"**
**Run:** `npm test -- --coverage --watchAll=false`. Target: 70% threshold met.

---

## Phase 9: Final Verification

### 9.1 Full regression test
- `npm run build` succeeds
- `npm test -- --coverage --watchAll=false` passes with 70%+ coverage
- `npm run lint` passes
- Manual smoke test of all user flows

### 9.2 Security verification
- No `REACT_APP_SENDGRID_API_KEY` in build output
- No hardcoded emails in firestore.rules
- No `console.log` with PII in service files
- `setupAdmin` requires admin claim
- `hasPermission` ignores userData fields

**Final commit: "Final verification and cleanup"**

---

## Not In Scope (Future Work)

These items from CODEBASE_AUDIT are important but too large for this branch:

- **Story 2.1** Account merge confirmation flow (needs UX design)
- **Story 4.2** Real push notifications via Cloud Functions (needs backend work)
- **Story 4.4** Email template consolidation (large refactor)
- **Story 4.5** Fix scheduledSendStatements crash (Cloud Functions deploy)
- **Story 6.1** Resolve App Engine vs Firebase Hosting
- **Story 6.3** Set up monitoring and alerting (infrastructure)
- **Story 7.1** REST API layer (major new feature)
- **Story 7.2** Extract business logic from page components (large refactor)
- **Story 7.3** Cursor-based pagination (needs API changes)
- **Story 8.1** Merge duplicate AccountOverview pages (needs UX review)
- **Story 9.1** Document ID strategy migration (data migration)
- **DEPOSIT_REQUEST_IMPLEMENTATION_PLAN.md** execution

---

## Commit Strategy

Each phase produces one commit. Phases are designed so the app remains functional after each commit. If a phase causes regressions, it can be reverted independently.

```
Phase 1: Fix critical security vulnerabilities (P0)
Phase 2: Fix authorization, validation, and data access bugs
Phase 3: Fix user and admin transaction visibility bugs
Phase 4: Fix notification pipeline and clean up dead code
Phase 5: Code cleanup, consistent error handling, remove dead code
Phase 6: Set up test infrastructure: MSW, factories, improved mocks
Phase 7: Add service layer unit tests
Phase 8: Add component and integration tests
Phase 9: Final verification and cleanup
```
