# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm start` - Start development server (runs on http://localhost:3000)
- `npm test` - Run tests in interactive watch mode
- `npm run build` - Build production bundle
- `npm install` - Install dependencies

### Testing
- Single test file: `npm test -- --testNamePattern="ComponentName"`
- Test coverage: `npm test -- --coverage --watchAll=false`

## Architecture Overview

This is a React-based minimalist banking application with role-based access control and Firebase integration.

### Authentication Architecture
- **Dual Auth System**: Uses both Firebase Auth (`getAuth()`) and custom Redux state management
- **Auth Flow**: Firebase handles Google OAuth → Custom `AuthProvider` context manages app state → Redux stores auth state
- **Role-Based Routing**: Admin users get different routes/components than regular customers
- **Session Management**: Custom session tokens stored in localStorage alongside Firebase tokens

### State Management
- **Redux Toolkit**: Primary state management (`src/store/`)
- **Auth Slice**: Manages user authentication state and admin flags
- **Transactions Slice**: Handles transaction data and processing
- **Context API**: `AuthProvider` bridges Firebase auth with Redux state

### Key Components Structure
- **Pages**: Route-level components (`/auth`, `/account/:user_id`, `/admin`, `/dashboard`)
- **Protected Routes**: All routes except `/auth` require authentication
- **Admin Routes**: `/admin` route restricted to users with `administrator: true`
- **Conditional Navigation**: Users auto-redirect based on auth status and admin role

### Firebase Integration
- **Firestore Collections**: `accounts` collection stores user data and banking information
- **Real-time Auth**: Uses `onAuthStateChanged` and `onIdTokenChanged` listeners
- **Token Refresh**: Automatic token refresh every 30 minutes
- **Session Tracking**: Updates `lastLogin`, `lastIp`, and `lastSessionToken` on auth changes

### Material-UI Theme
- Uses centralized theme configuration with primary color `#1976d2`
- Theme defined in both `App.js` and `index.js` (appears duplicated)

## Environment Configuration

Required `.env` variables for Firebase:
```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
```

## Code Patterns

### Firebase Service Pattern
Services in `src/services/` handle Firestore operations:
- `userService.js` - User account management
- `transactionService.js` - Transaction operations
- `dataService.js` - General data operations
- `transactionProcessor.js` - Transaction processing logic

### Component Organization
- Pages in `src/pages/` are route-level components
- Reusable components in `src/components/`
- Utilities in `src/utils/` (formatting helpers, etc.)

### Authentication Checks
Always check both Redux auth state AND Firebase auth state when implementing auth-dependent features.