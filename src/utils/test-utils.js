import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import transactionsReducer from '../store/slices/transactionsSlice';

// Create theme for testing
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Create a test store
const createTestStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      transactions: transactionsReducer,
    },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
};

// Custom render function that includes providers
const customRender = (ui, options = {}) => {
  const {
    preloadedState = {},
    store = createTestStore(preloadedState),
    ...renderOptions
  } = options;

  const Wrapper = ({ children }) => (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
};

// Mock user data for testing
export const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  administrator: false,
};

export const mockAdminUser = {
  ...mockUser,
  uid: 'admin-user-123',
  email: 'admin@example.com',
  displayName: 'Admin User',
  administrator: true,
};

// Mock transaction data
export const mockTransaction = {
  id: 'transaction-123',
  user_id: 'test-user-123',
  amount: 100.50,
  transaction_type: 'deposit',
  comment: 'Test deposit',
  timestamp: new Date('2024-01-01T10:00:00Z'),
};

export const mockTransactions = [
  mockTransaction,
  {
    id: 'transaction-456',
    user_id: 'test-user-123',
    amount: 50.25,
    transaction_type: 'withdrawal',
    comment: 'Test withdrawal',
    timestamp: new Date('2024-01-02T10:00:00Z'),
  },
  {
    id: 'transaction-789',
    user_id: 'test-user-123',
    amount: 25.00,
    transaction_type: 'service_charge',
    comment: 'Monthly fee',
    timestamp: new Date('2024-01-03T10:00:00Z'),
  },
];

// Mock transaction summary
export const mockTransactionSummary = {
  balance: 125.25,
  deposits: 100.50,
  withdrawals: 50.25,
  serviceCharges: 25.00,
  interests: 0,
};

// Mock auth states
export const mockAuthenticatedState = {
  auth: {
    isAuthenticated: true,
    user: mockUser,
    isAdmin: false,
    uid: mockUser.uid,
    loading: false,
    error: null,
    sessionToken: 'test-session-token',
  },
};

export const mockAdminAuthenticatedState = {
  auth: {
    isAuthenticated: true,
    user: mockAdminUser,
    isAdmin: true,
    uid: mockAdminUser.uid,
    loading: false,
    error: null,
    sessionToken: 'admin-session-token',
  },
};

export const mockUnauthenticatedState = {
  auth: {
    isAuthenticated: false,
    user: null,
    isAdmin: false,
    uid: null,
    loading: false,
    error: null,
    sessionToken: null,
  },
};

// Helper functions for testing
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// Mock Firebase functions
export const mockFirebaseAuth = {
  currentUser: mockUser,
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn(),
};

export const mockFirestore = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(() =>
        Promise.resolve({
          exists: true,
          data: () => mockUser,
        })
      ),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
    })),
    add: jest.fn(() =>
      Promise.resolve({
        id: 'new-doc-id',
      })
    ),
    where: jest.fn(() => ({
      get: jest.fn(() =>
        Promise.resolve({
          docs: [
            {
              id: 'doc-id',
              data: () => mockUser,
            },
          ],
        })
      ),
    })),
  })),
};

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render method
export { customRender as render };