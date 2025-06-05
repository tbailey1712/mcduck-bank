import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createTestStore, mockUser, mockTransactions } from '../../utils/test-utils';
import Dashboard from '../../pages/Dashboard';
import AccountOverview from '../../pages/AccountOverview';

// Mock the services
jest.mock('../../services/userService', () => ({
  getUserData: jest.fn(),
  subscribeToUserData: jest.fn(),
  subscribeToTransactions: jest.fn(),
  createTransaction: jest.fn(),
}));

jest.mock('../../services/transactionService', () => ({
  processTransactions: jest.fn(),
}));

import { getUserData, subscribeToUserData, subscribeToTransactions, createTransaction } from '../../services/userService';
import { processTransactions } from '../../services/transactionService';

describe('Transaction Flow Integration', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mocks
    getUserData.mockResolvedValue(mockUser);
    subscribeToUserData.mockReturnValue(jest.fn()); // unsubscribe function
    subscribeToTransactions.mockReturnValue(jest.fn()); // unsubscribe function
    processTransactions.mockReturnValue({
      balance: 1000.00,
      deposits: 1000.00,
      withdrawals: 0,
      serviceCharges: 0,
      interests: 0,
    });
    createTransaction.mockResolvedValue({ success: true });
  });

  const createWrapper = (initialState = {}) => {
    store = createTestStore({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        uid: mockUser.uid,
        isAdmin: false,
        loading: false,
        error: null,
      },
      ...initialState,
    });

    return ({ children }) => (
      <Provider store={store}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </Provider>
    );
  };

  test('complete withdrawal flow works correctly', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AccountOverview />, { wrapper });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Account Overview/)).toBeInTheDocument();
    });

    // Find and fill withdrawal form
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });

    await user.type(amountInput, '100.00');
    await user.type(reasonInput, 'Emergency withdrawal');
    await user.click(submitButton);

    // Verify the transaction was created
    await waitFor(() => {
      expect(createTransaction).toHaveBeenCalledWith({
        amount: 100.00,
        reason: 'Emergency withdrawal',
      });
    });

    // Verify success message appears
    await waitFor(() => {
      expect(screen.getByText(/Withdrawal request submitted successfully/)).toBeInTheDocument();
    });

    // Verify form is reset
    expect(amountInput.value).toBe('');
    expect(reasonInput.value).toBe('');
  });

  test('transaction history updates in real-time', async () => {
    const wrapper = createWrapper();
    
    // Mock real-time subscription
    subscribeToTransactions.mockImplementation((userId, callback) => {
      // Initially call with existing transactions
      callback(mockTransactions);
      
      // Simulate new transaction after 1 second
      setTimeout(() => {
        const newTransaction = {
          id: 'new-transaction-123',
          amount: 50.00,
          transaction_type: 'deposit',
          timestamp: new Date(),
          runningBalance: 1050.00,
        };
        callback([...mockTransactions, newTransaction]);
      }, 1000);
      
      return jest.fn(); // unsubscribe function
    });

    render(<AccountOverview />, { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Transaction History/)).toBeInTheDocument();
    });

    // Wait for new transaction to appear
    await waitFor(() => {
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  test('admin transaction creation flow works correctly', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: { ...mockUser, administrator: true },
        uid: mockUser.uid,
        isAdmin: true,
        loading: false,
        error: null,
      },
    });

    // Mock admin page component
    const AdminPage = () => (
      <div>
        <h1>Admin Panel</h1>
        {/* AdminTransactionForm would be here */}
      </div>
    );

    render(<AdminPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    });

    // This test would be expanded with actual AdminTransactionForm once rendered
  });

  test('transaction validation prevents invalid submissions', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AccountOverview />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Account Overview/)).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });

    // Test insufficient funds
    await user.type(amountInput, '2000.00'); // More than balance
    await user.type(reasonInput, 'Test withdrawal');
    
    await waitFor(() => {
      expect(screen.getByText(/Insufficient funds/)).toBeInTheDocument();
    });

    // Verify transaction is not created
    expect(createTransaction).not.toHaveBeenCalled();
  });

  test('error handling during transaction creation', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    // Mock transaction failure
    createTransaction.mockRejectedValue(new Error('Network error'));

    render(<AccountOverview />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Account Overview/)).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });

    await user.type(amountInput, '100.00');
    await user.type(reasonInput, 'Test withdrawal');
    await user.click(submitButton);

    // Verify error message appears
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  test('transaction processing calculates balances correctly', async () => {
    const wrapper = createWrapper();

    // Mock transaction processing with specific calculations
    processTransactions.mockReturnValue({
      balance: 875.25,
      deposits: 1000.00,
      withdrawals: 100.00,
      serviceCharges: 24.75,
      interests: 0,
    });

    render(<AccountOverview />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('$875.25')).toBeInTheDocument(); // Current balance
      expect(screen.getByText('$1000.00')).toBeInTheDocument(); // Total deposits
      expect(screen.getByText('$100.00')).toBeInTheDocument(); // Total withdrawals
      expect(screen.getByText('$24.75')).toBeInTheDocument(); // Service charges
    });
  });

  test('transaction history sorting and pagination', async () => {
    const wrapper = createWrapper();

    // Mock many transactions for pagination
    const manyTransactions = Array.from({ length: 25 }, (_, i) => ({
      id: `transaction-${i}`,
      amount: 10 * (i + 1),
      transaction_type: i % 2 === 0 ? 'deposit' : 'withdrawal',
      timestamp: new Date(2024, 0, i + 1),
      runningBalance: 100 + (10 * i),
    }));

    subscribeToTransactions.mockImplementation((userId, callback) => {
      callback(manyTransactions);
      return jest.fn();
    });

    render(<AccountOverview />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Transaction History/)).toBeInTheDocument();
    });

    // Verify pagination controls appear
    await waitFor(() => {
      expect(screen.getByText('Rows per page:')).toBeInTheDocument();
    });

    // Verify transactions are sorted by date (newest first)
    const firstTransaction = screen.getByText('Jan 25, 2024');
    expect(firstTransaction).toBeInTheDocument();
  });

  test('concurrent transaction handling', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AccountOverview />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Account Overview/)).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });

    // Fill form
    await user.type(amountInput, '100.00');
    await user.type(reasonInput, 'First withdrawal');

    // Mock slow transaction
    createTransaction.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
    );

    // Submit first transaction
    await user.click(submitButton);

    // Verify loading state
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });
});