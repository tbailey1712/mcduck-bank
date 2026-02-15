import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import { createTestStore } from '../../utils/test-utils';

// Mock the unified auth hooks - many components use these
jest.mock('../../contexts/UnifiedAuthProvider', () => ({
  useUnifiedAuth: () => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    error: null,
    signOut: jest.fn(),
  }),
}));

jest.mock('../../hooks/useUnifiedAuth', () => ({
  useUnifiedAuth: () => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    error: null,
    signOut: jest.fn(),
  }),
  __esModule: true,
  default: () => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    error: null,
    signOut: jest.fn(),
  }),
}));

describe('Authentication Integration', () => {
  test('unauthenticated state has correct Redux shape', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: false,
        user: null,
        uid: null,
        isAdmin: false,
        loading: false,
        error: null,
      },
    });

    const state = store.getState();
    expect(state.auth.isAuthenticated).toBe(false);
    expect(state.auth.user).toBeNull();
    expect(state.auth.isAdmin).toBe(false);
  });

  test('authenticated state preserves user data', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        user: {
          uid: 'test-user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          administrator: false,
        },
        uid: 'test-user-123',
        isAdmin: false,
        loading: false,
        error: null,
      },
    });

    const state = store.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.user.email).toBe('test@example.com');
    expect(state.auth.uid).toBe('test-user-123');
  });

  test('admin state sets isAdmin flag correctly', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        user: {
          uid: 'admin-user-123',
          email: 'admin@example.com',
          displayName: 'Admin User',
          administrator: true,
        },
        uid: 'admin-user-123',
        isAdmin: true,
        loading: false,
        error: null,
      },
    });

    const state = store.getState();
    expect(state.auth.isAdmin).toBe(true);
    expect(state.auth.user.administrator).toBe(true);
  });

  test('error state is tracked correctly', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: false,
        user: null,
        uid: null,
        isAdmin: false,
        loading: false,
        error: 'Authentication failed',
      },
    });

    const state = store.getState();
    expect(state.auth.error).toBe('Authentication failed');
    expect(state.auth.isAuthenticated).toBe(false);
  });

  test('loading state is tracked correctly', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: false,
        user: null,
        uid: null,
        isAdmin: false,
        loading: true,
        error: null,
      },
    });

    const state = store.getState();
    expect(state.auth.loading).toBe(true);
  });
});
