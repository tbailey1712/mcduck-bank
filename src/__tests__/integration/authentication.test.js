import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createTestStore } from '../../utils/test-utils';
import App from '../../App';

// Mock the Firebase auth methods
jest.mock('../../config/firebaseConfig', () => require('../../__mocks__/firebase'));

describe('Authentication Integration', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  const renderApp = (initialState = {}) => {
    const testStore = createTestStore(initialState);
    return render(
      <Provider store={testStore}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    );
  };

  test('redirects unauthenticated users to auth page', async () => {
    const initialState = {
      auth: {
        isAuthenticated: false,
        user: null,
        uid: null,
        isAdmin: false,
        loading: false,
        error: null,
      },
    };

    renderApp(initialState);

    await waitFor(() => {
      expect(screen.getByText(/Sign In/)).toBeInTheDocument();
    });
  });

  test('shows dashboard for authenticated users', async () => {
    const initialState = {
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
    };

    renderApp(initialState);

    await waitFor(() => {
      expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    });
  });

  test('shows admin panel for admin users', async () => {
    const initialState = {
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
    };

    renderApp(initialState);

    await waitFor(() => {
      expect(screen.getByText(/Admin Dashboard/)).toBeInTheDocument();
    });
  });

  test('handles authentication errors gracefully', async () => {
    const initialState = {
      auth: {
        isAuthenticated: false,
        user: null,
        uid: null,
        isAdmin: false,
        loading: false,
        error: 'Authentication failed',
      },
    };

    renderApp(initialState);

    await waitFor(() => {
      expect(screen.getByText(/Authentication failed/)).toBeInTheDocument();
    });
  });

  test('shows loading state during authentication', async () => {
    const initialState = {
      auth: {
        isAuthenticated: false,
        user: null,
        uid: null,
        isAdmin: false,
        loading: true,
        error: null,
      },
    };

    renderApp(initialState);

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  test('navigates between authenticated pages correctly', async () => {
    const user = userEvent.setup();
    const initialState = {
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
    };

    renderApp(initialState);

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    });

    // Navigate to account overview
    const accountLink = screen.getByRole('link', { name: /Account Overview/ });
    await user.click(accountLink);

    await waitFor(() => {
      expect(screen.getByText(/Account Overview/)).toBeInTheDocument();
    });
  });

  test('logout functionality works correctly', async () => {
    const user = userEvent.setup();
    const initialState = {
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
    };

    renderApp(initialState);

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    });

    // Click logout button
    const logoutButton = screen.getByRole('button', { name: /Logout/ });
    await user.click(logoutButton);

    // Should redirect to auth page
    await waitFor(() => {
      expect(screen.getByText(/Sign In/)).toBeInTheDocument();
    });
  });

  test('preserves user state across page refreshes', async () => {
    // Simulate localStorage having user data
    const userData = {
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      administrator: false,
    };

    localStorage.setItem('userToken', 'mock-token');
    localStorage.setItem('userData', JSON.stringify(userData));

    const initialState = {
      auth: {
        isAuthenticated: false,
        user: null,
        uid: null,
        isAdmin: false,
        loading: true, // Initially loading to simulate auth check
        error: null,
      },
    };

    renderApp(initialState);

    // Should eventually show dashboard after auth check
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('handles session expiration correctly', async () => {
    const initialState = {
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
    };

    renderApp(initialState);

    // Simulate session expiration by updating state
    store.dispatch({
      type: 'auth/logout',
    });

    await waitFor(() => {
      expect(screen.getByText(/Sign In/)).toBeInTheDocument();
    });
  });

  test('validates admin routes protection', async () => {
    const user = userEvent.setup();
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: {
          uid: 'test-user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          administrator: false, // Not admin
        },
        uid: 'test-user-123',
        isAdmin: false,
        loading: false,
        error: null,
      },
    };

    renderApp(initialState);

    // Try to navigate to admin route manually
    window.history.pushState({}, 'Admin Panel', '/admin');

    await waitFor(() => {
      // Should redirect to dashboard or show access denied
      expect(screen.queryByText(/Admin Dashboard/)).not.toBeInTheDocument();
    });
  });
});