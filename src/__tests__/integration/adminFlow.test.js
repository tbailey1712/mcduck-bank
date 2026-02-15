import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import { createTestStore, mockAdminUser, mockUser } from '../../utils/test-utils';

// Mock all heavy sub-components to isolate admin page logic
jest.mock('../../components/TelegramTestPanel', () => () => <div data-testid="telegram-panel" />);
jest.mock('../../components/AdminDebugInfo', () => () => <div data-testid="admin-debug" />);
jest.mock('../../components/CustomerList', () => (props) => <div data-testid="customer-list">{props.customers?.length || 0} customers</div>);
jest.mock('../../components/SystemConfiguration', () => () => <div data-testid="system-config" />);
jest.mock('../../components/AdminJobs', () => () => <div data-testid="admin-jobs" />);
jest.mock('../../components/TransactionForm', () => () => <div data-testid="transaction-form" />);

// Mock services used by AdminPanel - use plain functions to survive resetMocks: true
jest.mock('../../services/transactionService', () => ({
  fetchAndProcessTransactions: (userId, user) => Promise.resolve({ summary: { balance: 0 }, transactions: [] }),
}));
jest.mock('../../services/auditService', () => ({
  __esModule: true,
  default: { logAdminEvent: () => Promise.resolve(), logTransactionEvent: () => Promise.resolve() },
  AUDIT_EVENTS: { CONFIG_UPDATED: 'CONFIG_UPDATED', TRANSACTION_CREATED: 'TRANSACTION_CREATED', CLOUD_FUNCTION_EXECUTED: 'CLOUD_FUNCTION_EXECUTED' },
}));
jest.mock('../../services/adminCloudFunctions', () => ({
  __esModule: true,
  default: {
    setupAdmin: () => Promise.resolve({ message: 'done' }),
    calculateInterest: () => Promise.resolve({ results: {} }),
    sendMonthlyStatements: () => Promise.resolve({ results: {} }),
    getErrorMessage: (e) => e.message,
  },
}));
jest.mock('../../services/withdrawalTaskService', () => ({
  __esModule: true,
  default: { createWithdrawalRequest: () => Promise.resolve({ success: true }) },
}));
jest.mock('../../services/withdrawalDepositService', () => ({
  __esModule: true,
  default: { createHouseDeposit: () => Promise.resolve() },
}));
jest.mock('../../services/serverNotificationService', () => ({
  __esModule: true,
  default: { sendDepositNotification: () => Promise.resolve(), sendWithdrawalNotification: () => Promise.resolve() },
}));

// Mock useUnifiedAuth for AdminPanel - use a closure variable for dynamic return values
let mockAuthReturn = { user: null, isAdmin: false, isAuthenticated: false, loading: false };
jest.mock('../../contexts/UnifiedAuthProvider', () => ({
  useUnifiedAuth: () => mockAuthReturn,
}));

// Mock useNavigate - variable must be prefixed with "mock" for jest.mock() scope
let mockNavigateCalls = [];
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => (...args) => { mockNavigateCalls.push(args); },
  };
});

// Import after mocks - must come after jest.mock() calls
import AdminDashboard from '../../pages/AdminDashboard'; // eslint-disable-line import/first
import AdminPanel from '../../pages/AdminPanel'; // eslint-disable-line import/first

describe('Admin Flow Integration', () => {
  beforeEach(() => {
    mockNavigateCalls = [];
  });

  describe('AdminDashboard', () => {
    test('renders dashboard heading and pending approvals table', async () => {
      render(<AdminDashboard />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: mockAdminUser,
            uid: mockAdminUser.uid,
            isAdmin: true,
            loading: false,
            error: null,
          },
        },
      });

      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Pending Withdrawal Approvals')).toBeInTheDocument();
    });

    test('renders table headers for pending approvals', async () => {
      render(<AdminDashboard />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: mockAdminUser,
            uid: mockAdminUser.uid,
            isAdmin: true,
            loading: false,
            error: null,
          },
        },
      });

      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Reason')).toBeInTheDocument();
      expect(screen.getByText('Requested By')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    test('renders sub-components', async () => {
      render(<AdminDashboard />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: mockAdminUser,
            uid: mockAdminUser.uid,
            isAdmin: true,
            loading: false,
            error: null,
          },
        },
      });

      expect(screen.getByTestId('telegram-panel')).toBeInTheDocument();
      expect(screen.getByTestId('admin-debug')).toBeInTheDocument();
    });
  });

  describe('AdminPanel', () => {
    test('redirects non-admin users to home', () => {
      mockAuthReturn = { user: mockUser, isAdmin: false, isAuthenticated: true, loading: false };

      render(<AdminPanel />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: mockUser,
            uid: mockUser.uid,
            isAdmin: false,
            loading: false,
            error: null,
          },
        },
      });

      expect(mockNavigateCalls.length).toBeGreaterThan(0);
      expect(mockNavigateCalls[0][0]).toBe('/');
    });

    test('redirects when user is null', () => {
      mockAuthReturn = { user: null, isAdmin: false, isAuthenticated: false, loading: false };

      render(<AdminPanel />, {
        preloadedState: {
          auth: {
            isAuthenticated: false,
            user: null,
            uid: null,
            isAdmin: false,
            loading: false,
            error: null,
          },
        },
      });

      expect(mockNavigateCalls.length).toBeGreaterThan(0);
      expect(mockNavigateCalls[0][0]).toBe('/');
    });

    test('renders admin dashboard for admin users after loading', async () => {
      mockAuthReturn = { user: mockAdminUser, isAdmin: true, isAuthenticated: true, loading: false };

      render(<AdminPanel />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: mockAdminUser,
            uid: mockAdminUser.uid,
            isAdmin: true,
            loading: false,
            error: null,
          },
        },
      });

      // Initially shows loading
      expect(screen.getByText('Loading admin dashboard...')).toBeInTheDocument();

      // After loading resolves, shows the dashboard
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });
    });

    test('renders all admin sub-components after loading', async () => {
      mockAuthReturn = { user: mockAdminUser, isAdmin: true, isAuthenticated: true, loading: false };

      render(<AdminPanel />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: mockAdminUser,
            uid: mockAdminUser.uid,
            isAdmin: true,
            loading: false,
            error: null,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('transaction-form')).toBeInTheDocument();
      });
      expect(screen.getByTestId('customer-list')).toBeInTheDocument();
      expect(screen.getByTestId('system-config')).toBeInTheDocument();
      expect(screen.getByTestId('admin-jobs')).toBeInTheDocument();
    });
  });

  describe('Admin Redux State', () => {
    test('admin state has correct shape', () => {
      const store = createTestStore({
        auth: {
          isAuthenticated: true,
          user: mockAdminUser,
          uid: mockAdminUser.uid,
          isAdmin: true,
          loading: false,
          error: null,
        },
      });

      const state = store.getState();
      expect(state.auth.isAdmin).toBe(true);
      expect(state.auth.user.administrator).toBe(true);
      expect(state.auth.isAuthenticated).toBe(true);
    });

    test('non-admin state does not have isAdmin flag', () => {
      const store = createTestStore({
        auth: {
          isAuthenticated: true,
          user: mockUser,
          uid: mockUser.uid,
          isAdmin: false,
          loading: false,
          error: null,
        },
      });

      const state = store.getState();
      expect(state.auth.isAdmin).toBe(false);
      expect(state.auth.user.administrator).toBe(false);
    });
  });
});
