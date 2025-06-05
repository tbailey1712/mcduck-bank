import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createTestStore, mockUser, mockTransactions } from '../../utils/test-utils';
import useAccountData from '../useAccountData';

// Mock the services
jest.mock('../../services/userService', () => ({
  getUserData: jest.fn(),
  subscribeToUserData: jest.fn(),
  subscribeToTransactions: jest.fn(),
}));

jest.mock('../../services/transactionService', () => ({
  processTransactions: jest.fn(),
}));

import { getUserData, subscribeToUserData, subscribeToTransactions } from '../../services/userService';
import { processTransactions } from '../../services/transactionService';

describe('useAccountData', () => {
  let store;
  
  const createWrapper = (initialState = {}) => {
    store = createTestStore(initialState);
    return ({ children }) => (
      <Provider store={store}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    getUserData.mockResolvedValue(mockUser);
    subscribeToUserData.mockReturnValue(jest.fn()); // unsubscribe function
    subscribeToTransactions.mockReturnValue(jest.fn()); // unsubscribe function
    processTransactions.mockReturnValue({
      balance: 125.25,
      deposits: 100.50,
      withdrawals: 50.25,
      serviceCharges: 25.00,
      interests: 0,
    });
  });

  test('initializes with loading state', () => {
    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        isAdmin: false,
        uid: mockUser.uid,
        loading: false,
        error: null,
      },
    });

    const { result } = renderHook(() => useAccountData(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.userData).toBe(null);
    expect(result.current.transactions).toEqual([]);
  });

  test('fetches user data on mount', async () => {
    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        isAdmin: false,
        uid: mockUser.uid,
        loading: false,
        error: null,
      },
    });

    renderHook(() => useAccountData(), { wrapper });

    await waitFor(() => {
      expect(getUserData).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  test('sets up subscriptions for user data and transactions', async () => {
    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        isAdmin: false,
        uid: mockUser.uid,
        loading: false,
        error: null,
      },
    });

    renderHook(() => useAccountData(), { wrapper });

    await waitFor(() => {
      expect(subscribeToUserData).toHaveBeenCalled();
    });

    // Wait for user data to be set, then transactions subscription should be called
    await waitFor(() => {
      expect(subscribeToTransactions).toHaveBeenCalled();
    });
  });

  test('handles admin user viewing other users', async () => {
    // Mock URL params for admin viewing another user
    const mockUseParams = jest.fn(() => ({ user_id: 'other-user-123' }));
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useParams: mockUseParams,
    }));

    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: { ...mockUser, administrator: true },
        isAdmin: true,
        uid: mockUser.uid,
        loading: false,
        error: null,
      },
    });

    renderHook(() => useAccountData(), { wrapper });

    await waitFor(() => {
      expect(getUserData).toHaveBeenCalledWith('other-user-123');
    });
  });

  test('handles errors gracefully', async () => {
    getUserData.mockRejectedValue(new Error('Network error'));

    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        isAdmin: false,
        uid: mockUser.uid,
        loading: false,
        error: null,
      },
    });

    const { result } = renderHook(() => useAccountData(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });
  });

  test('redirects to auth when user is not authenticated', () => {
    const mockNavigate = jest.fn();
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));

    const wrapper = createWrapper({
      auth: {
        isAuthenticated: false,
        user: null,
        isAdmin: false,
        uid: null,
        loading: false,
        error: null,
      },
    });

    renderHook(() => useAccountData(), { wrapper });

    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });

  test('refresh data function works correctly', async () => {
    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        isAdmin: false,
        uid: mockUser.uid,
        loading: false,
        error: null,
      },
    });

    const { result } = renderHook(() => useAccountData(), { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call refresh
    await result.current.refreshData();

    expect(getUserData).toHaveBeenCalledTimes(2);
  });

  test('processes transactions correctly', async () => {
    subscribeToTransactions.mockImplementation((userId, callback) => {
      // Simulate calling the callback with transactions
      callback(mockTransactions);
      return jest.fn(); // unsubscribe function
    });

    const wrapper = createWrapper({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        isAdmin: false,
        uid: mockUser.uid,
        loading: false,
        error: null,
      },
    });

    const { result } = renderHook(() => useAccountData(), { wrapper });

    await waitFor(() => {
      expect(processTransactions).toHaveBeenCalledWith(mockTransactions);
      expect(result.current.transactionSummary).toEqual({
        balance: 125.25,
        deposits: 100.50,
        withdrawals: 50.25,
        serviceCharges: 25.00,
        interests: 0,
      });
    });
  });
});