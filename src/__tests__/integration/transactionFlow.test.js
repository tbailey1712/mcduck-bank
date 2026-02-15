import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import { createTestStore, mockUser, mockTransactions } from '../../utils/test-utils';
import { processTransactions } from '../../services/transactionService';

// Mock services to avoid Firebase calls
jest.mock('../../services/userService', () => ({
  getUserData: jest.fn(),
  subscribeToUserData: jest.fn(() => jest.fn()),
  subscribeToTransactions: jest.fn(() => jest.fn()),
  createTransaction: jest.fn(),
}));

jest.mock('../../services/transactionService', () => {
  const actual = jest.requireActual('../../services/transactionService');
  return {
    ...actual,
    getTransactions: jest.fn(),
    fetchAndProcessTransactions: jest.fn(),
  };
});

describe('Transaction Flow', () => {
  test('processTransactions calculates correct summary from mixed transactions', () => {
    const transactions = [
      { id: '1', amount: 1000, transaction_type: 'deposit', timestamp: new Date('2024-01-01') },
      { id: '2', amount: 200, transaction_type: 'deposit', timestamp: new Date('2024-02-01') },
      { id: '3', amount: 100, transaction_type: 'withdrawal', timestamp: new Date('2024-03-01') },
      { id: '4', amount: 24.75, transaction_type: 'service_charge', timestamp: new Date('2024-04-01') },
      { id: '5', amount: 5, transaction_type: 'interest', timestamp: new Date('2024-05-01') },
    ];

    const result = processTransactions(transactions);

    expect(result.deposits).toBe(1200);
    expect(result.withdrawals).toBe(100);
    expect(result.serviceCharges).toBe(24.75);
    expect(result.interests).toBe(5);
    expect(result.balance).toBe(1080.25); // 1200 - 100 - 24.75 + 5
  });

  test('processTransactions handles empty transactions', () => {
    const result = processTransactions([]);
    expect(result.balance).toBe(0);
    expect(result.deposits).toBe(0);
    expect(result.withdrawals).toBe(0);
  });

  test('processTransactions handles deposit-only transactions', () => {
    const transactions = [
      { id: '1', amount: 500, transaction_type: 'deposit', timestamp: new Date('2024-01-01') },
      { id: '2', amount: 300, transaction_type: 'deposit', timestamp: new Date('2024-02-01') },
    ];

    const result = processTransactions(transactions);
    expect(result.balance).toBe(800);
    expect(result.deposits).toBe(800);
    expect(result.withdrawals).toBe(0);
  });

  test('Redux store holds auth state for transaction operations', () => {
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
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.uid).toBe(mockUser.uid);
  });
});
