/**
 * Test Data Factories
 * Generates realistic mock data for tests. Override any field via the overrides parameter.
 */

let _idCounter = 0;
const nextId = (prefix = 'id') => `${prefix}-${++_idCounter}`;

// Reset counter between test suites
export const resetFactoryIds = () => { _idCounter = 0; };

// --- Users ---

export const buildUser = (overrides = {}) => ({
  uid: nextId('user'),
  email: `user${_idCounter}@mcduckbank.com`,
  displayName: `Test User ${_idCounter}`,
  photoURL: null,
  administrator: false,
  emailVerified: true,
  ...overrides,
});

export const buildAdminUser = (overrides = {}) =>
  buildUser({ administrator: true, displayName: 'Admin User', ...overrides });

// --- Accounts (Firestore docs keyed by email) ---

export const buildAccount = (overrides = {}) => {
  const user = buildUser();
  return {
    id: user.email, // doc ID is email
    user_id: user.uid,
    email: user.email,
    displayName: user.displayName,
    administrator: false,
    balance: 1000,
    lastLogin: new Date().toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    notification_preferences: {
      enabled: true,
      channels: { email: { enabled: true }, telegram: { enabled: false } },
      events: {},
    },
    ...overrides,
  };
};

// --- Transactions ---

export const buildTransaction = (overrides = {}) => ({
  id: nextId('txn'),
  user_id: 'user-1',
  amount: 100,
  transaction_type: 'deposit',
  comment: 'Test transaction',
  description: 'Test transaction',
  timestamp: new Date('2024-06-15T12:00:00Z'),
  ...overrides,
});

export const buildDeposit = (overrides = {}) =>
  buildTransaction({ transaction_type: 'deposit', comment: 'Deposit', ...overrides });

export const buildWithdrawal = (overrides = {}) =>
  buildTransaction({ transaction_type: 'withdrawal', comment: 'Withdrawal', ...overrides });

export const buildInterest = (overrides = {}) =>
  buildTransaction({ transaction_type: 'interest', comment: 'Monthly interest', amount: 5.25, ...overrides });

export const buildServiceCharge = (overrides = {}) =>
  buildTransaction({ transaction_type: 'service_charge', comment: 'Monthly fee', amount: 2.50, ...overrides });

// Build a set of transactions that produce a known balance
export const buildTransactionSet = (userId = 'user-1') => [
  buildDeposit({ user_id: userId, amount: 500, timestamp: new Date('2024-01-01') }),
  buildDeposit({ user_id: userId, amount: 200, timestamp: new Date('2024-02-01') }),
  buildWithdrawal({ user_id: userId, amount: 100, timestamp: new Date('2024-03-01') }),
  buildInterest({ user_id: userId, amount: 10.50, timestamp: new Date('2024-04-01') }),
  buildServiceCharge({ user_id: userId, amount: 5, timestamp: new Date('2024-05-01') }),
  // Expected balance: 500 + 200 - 100 + 10.50 - 5 = 605.50
];

// --- Withdrawal Requests ---

export const buildWithdrawalRequest = (overrides = {}) => ({
  id: nextId('wr'),
  user_id: 'user-1',
  user_email: 'user1@mcduckbank.com',
  user_name: 'Test User',
  amount: 50,
  description: 'Need cash',
  status: 'pending',
  created_at: { seconds: Date.now() / 1000, nanoseconds: 0 },
  updated_at: { seconds: Date.now() / 1000, nanoseconds: 0 },
  created_by: 'user-1',
  ...overrides,
});

export const buildApprovedRequest = (overrides = {}) =>
  buildWithdrawalRequest({
    status: 'approved',
    approved_by: 'admin-1',
    approved_at: { seconds: Date.now() / 1000, nanoseconds: 0 },
    transaction_id: 'txn-approved',
    ...overrides,
  });

export const buildRejectedRequest = (overrides = {}) =>
  buildWithdrawalRequest({
    status: 'rejected',
    rejected_by: 'admin-1',
    rejected_at: { seconds: Date.now() / 1000, nanoseconds: 0 },
    rejection_reason: 'Insufficient funds',
    ...overrides,
  });

// --- Auth States (for Redux store preloading) ---

export const buildAuthState = (overrides = {}) => {
  const user = overrides.user || buildUser();
  return {
    auth: {
      isAuthenticated: true,
      user,
      isAdmin: user.administrator || false,
      uid: user.uid,
      loading: false,
      error: null,
      sessionToken: 'test-session-token',
      ...overrides,
    },
  };
};

export const buildAdminAuthState = (overrides = {}) =>
  buildAuthState({ user: buildAdminUser(), isAdmin: true, ...overrides });

export const buildUnauthenticatedState = () => ({
  auth: {
    isAuthenticated: false,
    user: null,
    isAdmin: false,
    uid: null,
    loading: false,
    error: null,
    sessionToken: null,
  },
});
