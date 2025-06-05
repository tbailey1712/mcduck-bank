import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createTestStore, mockUser } from '../../utils/test-utils';
import AdminDashboard from '../../pages/AdminDashboard';
import AdminPanel from '../../pages/AdminPanel';

// Mock the services
jest.mock('../../services/userService', () => ({
  getAllUsers: jest.fn(),
  getUserData: jest.fn(),
  subscribeToUserData: jest.fn(),
  subscribeToTransactions: jest.fn(),
  createAdminTransaction: jest.fn(),
}));

jest.mock('../../services/dataService', () => ({
  getAllTransactions: jest.fn(),
  getUserTransactions: jest.fn(),
}));

import { getAllUsers, getUserData, createAdminTransaction } from '../../services/userService';
import { getAllTransactions, getUserTransactions } from '../../services/dataService';

describe('Admin Flow Integration', () => {
  let store;

  const mockAdminUser = {
    ...mockUser,
    administrator: true,
  };

  const mockUsers = [
    {
      uid: 'user-1',
      email: 'user1@example.com',
      displayName: 'User One',
      administrator: false,
    },
    {
      uid: 'user-2',
      email: 'user2@example.com',
      displayName: 'User Two',
      administrator: false,
    },
  ];

  const mockAllTransactions = [
    {
      id: 'txn-1',
      userId: 'user-1',
      amount: 100,
      transaction_type: 'deposit',
      timestamp: new Date('2024-01-01'),
    },
    {
      id: 'txn-2',
      userId: 'user-2',
      amount: 50,
      transaction_type: 'withdrawal',
      timestamp: new Date('2024-01-02'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mocks
    getAllUsers.mockResolvedValue(mockUsers);
    getUserData.mockResolvedValue(mockUsers[0]);
    getAllTransactions.mockResolvedValue(mockAllTransactions);
    getUserTransactions.mockResolvedValue([mockAllTransactions[0]]);
    createAdminTransaction.mockResolvedValue({ success: true });
  });

  const createWrapper = (initialState = {}) => {
    store = createTestStore({
      auth: {
        isAuthenticated: true,
        user: mockAdminUser,
        uid: mockAdminUser.uid,
        isAdmin: true,
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

  test('admin dashboard loads all users correctly', async () => {
    const wrapper = createWrapper();

    render(<AdminDashboard />, { wrapper });

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('User Two')).toBeInTheDocument();
    });

    expect(getAllUsers).toHaveBeenCalled();
  });

  test('admin can view individual user details', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AdminDashboard />, { wrapper });

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
    });

    // Click on a user
    const userLink = screen.getByText('User One');
    await user.click(userLink);

    // Should fetch user data
    await waitFor(() => {
      expect(getUserData).toHaveBeenCalledWith('user-1');
    });
  });

  test('admin transaction creation flow works correctly', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AdminPanel />, { wrapper });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    });

    // Find and fill admin transaction form
    const userIdInput = screen.getByLabelText(/User ID/);
    const typeSelect = screen.getByLabelText(/Transaction Type/);
    const amountInput = screen.getByLabelText(/Amount/);
    const descriptionInput = screen.getByLabelText(/Description/);
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });

    await user.type(userIdInput, 'user-1');
    await user.selectOptions(typeSelect, 'deposit');
    await user.type(amountInput, '250.00');
    await user.type(descriptionInput, 'Admin deposit for user');
    await user.click(submitButton);

    // Verify the transaction was created
    await waitFor(() => {
      expect(createAdminTransaction).toHaveBeenCalledWith({
        userId: 'user-1',
        transactionType: 'deposit',
        amount: 250.00,
        description: 'Admin deposit for user',
      });
    });

    // Verify success message appears
    await waitFor(() => {
      expect(screen.getByText(/Transaction created successfully/)).toBeInTheDocument();
    });
  });

  test('admin can view all transactions across users', async () => {
    const wrapper = createWrapper();

    render(<AdminPanel />, { wrapper });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/All Transactions/)).toBeInTheDocument();
    });

    // Verify all transactions are fetched and displayed
    await waitFor(() => {
      expect(getAllTransactions).toHaveBeenCalled();
      expect(screen.getByText('user-1')).toBeInTheDocument();
      expect(screen.getByText('user-2')).toBeInTheDocument();
    });
  });

  test('admin user search and filtering works', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AdminDashboard />, { wrapper });

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('User Two')).toBeInTheDocument();
    });

    // Find search input
    const searchInput = screen.getByPlaceholderText(/Search users/);
    await user.type(searchInput, 'User One');

    // Verify filtering works
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.queryByText('User Two')).not.toBeInTheDocument();
    });
  });

  test('admin transaction validation prevents invalid submissions', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AdminPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    });

    const userIdInput = screen.getByLabelText(/User ID/);
    const amountInput = screen.getByLabelText(/Amount/);
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });

    // Test with invalid user ID
    await user.type(userIdInput, 'invalid-user-id');
    await user.type(amountInput, '100.00');

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid user ID/)).toBeInTheDocument();
    });

    // Verify transaction is not created
    expect(createAdminTransaction).not.toHaveBeenCalled();
  });

  test('admin cannot access admin features if not admin', async () => {
    const nonAdminUser = {
      ...mockUser,
      administrator: false,
    };

    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: nonAdminUser,
        uid: nonAdminUser.uid,
        isAdmin: false,
        loading: false,
        error: null,
      },
    });

    render(<AdminDashboard />, { wrapper });

    // Should show access denied or redirect
    await waitFor(() => {
      expect(screen.getByText(/Access Denied/)).toBeInTheDocument();
    });
  });

  test('admin transaction history includes metadata', async () => {
    const wrapper = createWrapper();

    const transactionsWithMetadata = [
      {
        ...mockAllTransactions[0],
        createdBy: 'admin-user-123',
        adminNote: 'Manual adjustment',
      },
    ];

    getAllTransactions.mockResolvedValue(transactionsWithMetadata);

    render(<AdminPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/All Transactions/)).toBeInTheDocument();
    });

    // Verify admin metadata is displayed
    await waitFor(() => {
      expect(screen.getByText('Manual adjustment')).toBeInTheDocument();
      expect(screen.getByText(/Created by: admin-user-123/)).toBeInTheDocument();
    });
  });

  test('admin bulk operations work correctly', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    render(<AdminPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    });

    // Select multiple users for bulk operation
    const selectAllCheckbox = screen.getByLabelText(/Select all users/);
    await user.click(selectAllCheckbox);

    // Perform bulk operation
    const bulkActionButton = screen.getByRole('button', { name: /Apply Service Charge/ });
    await user.click(bulkActionButton);

    // Verify bulk operation confirmation
    await waitFor(() => {
      expect(screen.getByText(/Apply service charge to 2 users/)).toBeInTheDocument();
    });
  });

  test('admin export functionality works', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    // Mock URL.createObjectURL for CSV export
    global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
    
    render(<AdminPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByRole('button', { name: /Export Data/ });
    await user.click(exportButton);

    // Verify export options
    await waitFor(() => {
      expect(screen.getByText(/Export Users/)).toBeInTheDocument();
      expect(screen.getByText(/Export Transactions/)).toBeInTheDocument();
    });

    // Select and confirm export
    const exportUsersButton = screen.getByRole('button', { name: /Export Users/ });
    await user.click(exportUsersButton);

    // Verify getAllUsers was called for export
    expect(getAllUsers).toHaveBeenCalled();
  });

  test('admin error handling during user operations', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();

    // Mock user creation failure
    createAdminTransaction.mockRejectedValue(new Error('User creation failed'));

    render(<AdminPanel />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Admin Panel/)).toBeInTheDocument();
    });

    const userIdInput = screen.getByLabelText(/User ID/);
    const typeSelect = screen.getByLabelText(/Transaction Type/);
    const amountInput = screen.getByLabelText(/Amount/);
    const descriptionInput = screen.getByLabelText(/Description/);
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });

    await user.type(userIdInput, 'user-1');
    await user.selectOptions(typeSelect, 'deposit');
    await user.type(amountInput, '100.00');
    await user.type(descriptionInput, 'Test transaction');
    await user.click(submitButton);

    // Verify error message appears
    await waitFor(() => {
      expect(screen.getByText(/User creation failed/)).toBeInTheDocument();
    });
  });

  test('admin realtime updates for user activities', async () => {
    const wrapper = createWrapper();

    render(<AdminDashboard />, { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
    });

    // Simulate real-time user activity update
    const mockUpdatedUser = {
      ...mockUsers[0],
      lastActivity: new Date().toISOString(),
      balance: 150.00,
    };

    // Trigger update (in real implementation, this would come from Firebase)
    getAllUsers.mockResolvedValue([mockUpdatedUser, mockUsers[1]]);

    // Refresh component (simulating real-time update)
    const refreshButton = screen.getByRole('button', { name: /Refresh/ });
    await userEvent.setup().click(refreshButton);

    // Verify updated data is displayed
    await waitFor(() => {
      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });
  });
});