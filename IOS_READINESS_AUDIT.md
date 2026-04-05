# iOS Native App Readiness Audit

**Date:** 2026-04-05
**Scope:** Assess the existing McDuck Bank React web app for readiness to build a native iOS (Swift) counterpart.

---

## Executive Summary

The current app is a **client-side React SPA that talks directly to Firebase** (Firestore, Auth, Cloud Functions). There is **no REST API backend**. This is the single biggest factor shaping the iOS build: the Firebase iOS SDK can replicate nearly all current functionality, but several web-specific patterns need rethinking.

**Overall Readiness: MODERATE** -- Firebase's iOS SDK covers auth and data access well, but significant work is needed around security rules, business logic extraction, and offline/session architecture.

---

## 1. Architecture Assessment

### 1.1 Current Stack

| Layer | Technology | iOS Equivalent |
|-------|-----------|----------------|
| UI | React 19 + Material UI 7 | SwiftUI / UIKit |
| State | Redux Toolkit + Context API | SwiftUI `@Observable` / TCA / MVVM |
| Auth | Firebase Auth (Google OAuth) | Firebase Auth iOS SDK (Google Sign-In) |
| Database | Firestore (client SDK) | Firebase Firestore iOS SDK |
| Cloud Functions | Firebase callable functions (v2) | Same -- called via Firebase Functions iOS SDK |
| Notifications | Firebase Cloud Messaging (web push) | APNs + FCM iOS SDK |
| Email | SendGrid (via Cloud Functions) | No change (server-side) |
| Telegram | Axios (via Cloud Functions) | No change (server-side) |

### 1.2 No REST API Layer

**Critical finding:** All data access happens through the **Firestore client SDK directly from the browser**. There are no REST endpoints.

Services that perform direct Firestore reads/writes from the client:
- `apiService.js` -- user data, transactions (CRUD + real-time subscriptions)
- `transactionService.js` -- transaction queries + `onSnapshot` subscriptions
- `userService.js` -- account lookups and updates
- `withdrawalTaskService.js` -- withdrawal request lifecycle
- `auditService.js` -- audit log writes
- `adminService.js` -- admin operations

**iOS Impact:** The Firebase iOS SDK supports the same Firestore operations, so the app *can* work the same way. However, this means:
- Business logic lives in the client, not a server
- Security depends entirely on Firestore Security Rules
- Any logic changes must be deployed to both web and iOS

---

## 2. Firestore Collections & Data Model

### 2.1 Collections Inventory

| Collection | Doc ID Pattern | Key Fields | Used By |
|-----------|---------------|------------|---------|
| `accounts` | User email | `user_id`, `displayName`, `email`, `administrator`, `balance`, `lastLogin`, `lastBalanceUpdate`, `lastIp`, `lastSessionToken` | Auth, profile, admin |
| `transactions` | Auto-generated | `user_id`, `amount`, `transaction_type` (deposit/withdrawal/interest/service_charge/bankfee), `timestamp`, `comment`, `description`, `created_by` | Account views, balance calc |
| `withdrawal_tasks` | Auto-generated | `user_id`, `user_email`, `user_name`, `amount`, `description`, `status` (pending/approved/rejected/cancelled), `created_at`, `updated_at`, `admin_notes`, `rejection_reason` | Withdrawal flow |
| `audit_logs` | Auto-generated | `event_type`, `timestamp`, `user_id`, `user_email`, `details`, `session_id`, `user_agent`, `browser`, `platform` | Admin logs |
| `system` | `config` | `interest_rate`, `allowNewUsers` | System config |
| `job_logs` | Auto-generated | `jobName`, `timestamp`, `results`, `executedBy` | Admin jobs |
| `email_templates` | Template name | Template HTML content, description | Messages page |

### 2.2 Data Model Readiness for iOS

**Good:**
- Simple, flat document structures
- Consistent `user_id` field for querying
- Timestamps use Firestore `Timestamp` type (works natively on iOS)

**Concerns:**
- `accounts` documents are keyed by **email address** (not UID) -- unusual pattern, requires querying by `user_id` field separately
- Balance is calculated client-side by iterating all transactions -- this is expensive and should be a Cloud Function or Firestore trigger
- Transaction type field uses inconsistent naming (`transaction_type` in Firestore, mapped to `transactionType` in JS)

---

## 3. Authentication & Session Management

### 3.1 Current Auth Flow

```
Google OAuth popup/redirect
  -> Firebase Auth (onAuthStateChanged)
  -> Lookup user in accounts collection
  -> Check administrator flag (Firestore + custom claims)
  -> Generate session ID (UUID)
  -> Store in localStorage + sessionStorage + IndexedDB
  -> Set up 30-min token refresh interval
  -> 8-hour session timeout with activity tracking
```

### 3.2 iOS Auth Mapping

| Web Feature | iOS Approach | Effort |
|------------|-------------|--------|
| Google OAuth popup | Google Sign-In iOS SDK + Firebase Auth | Low |
| `onAuthStateChanged` listener | Same API in Firebase iOS SDK | Low |
| Custom claims check (`administrator`) | `getIDTokenResult()` on iOS | Low |
| Session token (UUID in localStorage) | Keychain storage | Medium |
| Browser fingerprinting | Not applicable -- use device ID | Medium |
| Multi-layer storage (localStorage/sessionStorage/IndexedDB) | Keychain + UserDefaults | Medium |
| 8-hour timeout with activity tracking | Background task + app lifecycle events | Medium |
| Rate limiting (5 attempts, 15-min lockout) | Reimplement client-side or move to Cloud Function | Medium |

### 3.3 Auth Risks

- **Login rate limiting is client-side only** -- trivially bypassable. Should be moved to a Cloud Function or Firestore rule.
- **`allowNewUsers` toggle is checked client-side** in `unifiedAuthService.js` -- a malicious client could bypass it. Needs Firestore Security Rules enforcement.
- **Session management is entirely web-specific** (browser fingerprinting, IndexedDB, etc.) -- must be rebuilt for iOS using Keychain and app lifecycle.

---

## 4. Cloud Functions Inventory

All callable functions require authentication. Admin functions additionally check `administrator` custom claim.

| Function | Type | Auth | Purpose | iOS Compatible |
|----------|------|------|---------|---------------|
| `setupAdmin` | Callable | Authenticated | Set admin custom claims | Yes |
| `cleanupWrongAccounts` | Callable | Admin | Delete incorrect account docs | Yes |
| `sendStatements` | Callable | Admin | Generate & email monthly statements | Yes |
| `sendTelegramNotification` | Callable | Admin | Send Telegram alert | Yes |
| `testSMS` | Callable | Any | Test function | Yes |
| `scheduledPayInterest` | Scheduled | N/A | Monthly interest calculation (1st @ 1am CT) | N/A (server) |
| `scheduledSendStatements` | Scheduled | N/A | Monthly statement emails (1st @ 2am CT) | N/A (server) |
| `healthCheck` | HTTP | None | Health endpoint | Yes (URL call) |

**iOS Impact:** All callable functions work identically via the Firebase Functions iOS SDK. Scheduled functions are server-side and unaffected.

---

## 5. Security Audit

### 5.1 Firestore Security Rules

**UNKNOWN / NOT AUDITED** -- Security rules were not found in the repository. This is a **critical gap**:
- If rules are permissive (e.g., allow read/write for authenticated users), any authenticated user could read other users' transactions or modify data
- The web app enforces access control in JavaScript (client-side) -- this is **not a security boundary**
- Before shipping iOS, Firestore Security Rules MUST be audited and hardened

### 5.2 Client-Side Security Logic That Must Move Server-Side

| Current Client Logic | Risk | Recommendation |
|---------------------|------|----------------|
| Balance calculation (sum all transactions) | Expensive, manipulable | Cloud Function or Firestore trigger to maintain cached balance |
| `allowNewUsers` check | Bypassable | Enforce in Firestore Security Rules or Cloud Function |
| Login rate limiting (5 attempts) | Bypassable | Move to Cloud Function with server-side counter |
| Admin permission check (`user.administrator`) | Can be spoofed if rules are weak | Enforce via custom claims in Security Rules |
| Input sanitization (DOMPurify, XSS prevention) | Web-specific | iOS needs its own input validation; server-side validation also recommended |
| Transaction CRUD authorization | Client-side permission checks | Must mirror in Firestore Security Rules |

### 5.3 Sensitive Data Handling

- Session tokens stored in `localStorage` (web) -- iOS should use **Keychain**
- Firebase tokens auto-managed by SDK on both platforms
- No secrets stored client-side (SendGrid key, Telegram tokens are in Cloud Functions env)

---

## 6. Feature Parity Matrix

### 6.1 Customer Features

| Feature | Web Status | iOS Feasibility | Notes |
|---------|-----------|-----------------|-------|
| Google OAuth login | Done | Easy | Google Sign-In iOS SDK |
| Account overview (balance, profile) | Done | Easy | Same Firestore queries |
| Transaction history (paginated, filtered) | Done | Easy | Firestore queries + SwiftUI List |
| Real-time transaction updates | Done | Easy | `onSnapshot` available on iOS |
| Submit withdrawal request | Done | Easy | Firestore write |
| View withdrawal request status | Done | Easy | Firestore query |
| Cancel pending withdrawal | Done | Easy | Firestore update |
| Edit profile (name, phone, notifications) | Done | Easy | Firestore update |
| Push notifications | Partial (web push) | Medium | Requires APNs setup + FCM iOS config |

### 6.2 Admin Features

| Feature | Web Status | iOS Feasibility | Notes |
|---------|-----------|-----------------|-------|
| Customer list with balances | Done | Easy | Firestore queries |
| Create transactions for customers | Done | Easy | Firestore write |
| Edit/delete transactions | Done | Easy | Firestore update/delete |
| Approve/reject withdrawals | Done | Easy | Firestore update |
| View audit logs (filtered) | Done | Medium | Complex filtering UI |
| System config (interest rate, registration) | Done | Easy | Firestore read/write |
| Trigger cloud functions (interest, statements) | Done | Easy | Firebase callable |
| Email template management | Done | Hard | HTML preview/editing on iOS is complex |
| CSV export of audit logs | Done | Medium | iOS share sheet with CSV |

### 6.3 Features Requiring Redesign for iOS

| Feature | Why |
|---------|-----|
| PWA install/update flow | Not applicable -- use App Store |
| Service worker caching | Use iOS URLCache / offline Firestore persistence |
| Force update page (clear caches) | Replace with standard iOS cache clearing |
| Browser fingerprinting | Replace with iOS device identification |
| Multi-tab session sync | Not applicable on iOS |
| `localStorage`/`sessionStorage`/IndexedDB persistence | Use Keychain + UserDefaults + Core Data |

---

## 7. Recommended Pre-Build Actions

### Priority 1 -- Security (Must Do Before iOS Launch)

1. **Audit and harden Firestore Security Rules** -- ensure users can only read/write their own data, admins have elevated access via custom claims
2. **Move balance calculation server-side** -- create a Cloud Function trigger on transaction writes to maintain `accounts.balance`
3. **Move `allowNewUsers` enforcement to Security Rules** -- don't rely on client-side checks
4. **Add server-side input validation** in Cloud Functions for transaction amounts, withdrawal requests

### Priority 2 -- Shared Infrastructure

5. **Extract business logic into Cloud Functions** where possible (transaction creation with validation, withdrawal approval flow) -- reduces duplication between web and iOS
6. **Standardize field naming** -- pick either `transaction_type` or `transactionType` and use it consistently
7. **Document the Firestore data model** formally so both platforms reference the same schema

### Priority 3 -- iOS-Specific Preparation

8. **Set up Firebase iOS project** in Firebase Console (add iOS app, download `GoogleService-Info.plist`)
9. **Configure APNs** for push notifications
10. **Design offline strategy** -- Firestore iOS SDK has built-in offline persistence, but decide on caching policy for transactions
11. **Plan Keychain storage** for session tokens and sensitive auth state

---

## 8. Recommended iOS Architecture

```
┌─────────────────────────────────────────┐
│              SwiftUI Views              │
│  (LoginView, AccountView, AdminView)    │
├─────────────────────────────────────────┤
│           ViewModels (@Observable)       │
│  (AuthVM, TransactionsVM, AdminVM)      │
├─────────────────────────────────────────┤
│            Service Layer                │
│  (AuthService, TransactionService,      │
│   WithdrawalService, AuditService)      │
├─────────────────────────────────────────┤
│          Firebase iOS SDK               │
│  (Auth, Firestore, Functions, FCM)      │
└─────────────────────────────────────────┘
```

**Key patterns:**
- MVVM with `@Observable` (Swift 5.9+) or `ObservableObject`
- Firestore listeners mapped to Combine publishers or AsyncStream
- Dependency injection for services (testability)
- Keychain wrapper for secure storage
- Swift Codable models mirroring Firestore document structure

---

## 9. Estimated Scope

| Component | Effort |
|-----------|--------|
| Firebase setup + auth (Google Sign-In) | 1-2 days |
| Data models + Firestore service layer | 2-3 days |
| Customer screens (account, transactions, withdrawals, profile) | 5-7 days |
| Admin screens (customer list, transaction mgmt, withdrawal approvals) | 5-7 days |
| Admin advanced (audit logs, system config, cloud function triggers) | 3-4 days |
| Push notifications (APNs + FCM) | 1-2 days |
| Session management + security | 2-3 days |
| Testing + polish | 3-5 days |
| **Total** | **~22-33 days** |

---

## 10. Conclusion

The app is **moderately ready** for an iOS port. Firebase as the backend is a major advantage since the iOS SDK mirrors the web SDK closely. The main blockers are:

1. **Security rules are unverified** -- this is the #1 risk
2. **Business logic lives in the client** -- creates duplication and security gaps
3. **Session management is web-specific** -- needs full redesign for iOS

The recommended path is: harden security rules first, extract critical business logic into Cloud Functions, then build the iOS app against the same Firestore backend.
