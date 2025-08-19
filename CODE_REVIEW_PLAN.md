
# Code Review & Refactoring Plan

This document outlines the plan for a comprehensive code review and subsequent refactoring of the McDuck Bank application.

## 1. Critical Security & Performance Fixes

- [x] **XSS Vulnerability in Email Service:** Sanitize HTML substitutions in `sendgridService.js` to prevent cross-site scripting. (Completed)
- [x] **Component Performance:** Refactor the large `AdminPanel.js` component into smaller, more focused components to improve load times and maintainability. (Completed)
- [ ] **Dependency Audit:** Run `npm audit` to identify and fix any known vulnerabilities in project dependencies. (Partially completed)
- [ ] **Force Dependency Audit:** Run `npm audit fix --force` to address remaining vulnerabilities. (Deferred due to potential breaking changes)
- [ ] **Code Splitting:** Implement lazy loading for routes/pages to reduce the initial bundle size and improve perceived performance.

## 2. Code Cleanup & Refactoring

- [ ] **Address ESLint Warnings:** Fix all ESLint warnings reported during the build process.
- [ ] **Remove Redundant Files:** Delete unused files such as `App.js.backup`, `darkTheme.js.new`, `MinimalApp.js`, `SimpleApp.js`, `TestApp.js`, and `TestMUI.js`.
- [ ] **Consolidate Data Hooks:** Deprecate and remove `useAccountData.legacy.js` and migrate all dependent components to the modern `useAccountData.js` hook.
- [ ] **Unify State Management:** Refactor components that use local `useState` for data that should be in the global Redux store (e.g., `AdminRequestsPage.js`).
- [ ] **Enforce Naming Conventions:** Standardize file and folder naming across the project (e.g., PascalCase for all React components).

## 3. Testing

- [ ] **Increase Test Coverage:** Write unit tests for critical components and services that currently lack them.
- [ ] **Add Integration Tests:** Create integration tests for key user flows, such as the authentication process and the transaction creation flow.

## 4. UI & Styling Consistency

- [ ] **Standardize Styling:** Establish a single, consistent approach to styling (e.g., prefer MUI's `sx` prop and themeing capabilities) and refactor components that use inconsistent methods (e.g., inline styles, separate CSS files).
