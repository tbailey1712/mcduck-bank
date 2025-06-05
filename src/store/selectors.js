import { createSelector } from '@reduxjs/toolkit';

/**
 * Memoized selectors for better performance
 * Prevents unnecessary re-renders when state hasn't changed
 */

// Base selectors
const selectAuth = (state) => state.auth;
const selectTransactions = (state) => state.transactions;

// Auth selectors
export const selectUser = createSelector(
  [selectAuth],
  (auth) => auth.user
);

export const selectIsAuthenticated = createSelector(
  [selectAuth],
  (auth) => auth.isAuthenticated
);

export const selectIsAdmin = createSelector(
  [selectUser],
  (user) => user?.administrator || user?.isAdmin || false
);

export const selectAuthLoading = createSelector(
  [selectAuth],
  (auth) => auth.loading
);

export const selectAuthError = createSelector(
  [selectAuth],
  (auth) => auth.error
);

export const selectUserId = createSelector(
  [selectUser],
  (user) => user?.uid
);

// Transaction selectors
export const selectAllTransactions = createSelector(
  [selectTransactions],
  (transactions) => transactions.items || []
);

export const selectTransactionsLoading = createSelector(
  [selectTransactions],
  (transactions) => transactions.loading
);

export const selectTransactionsError = createSelector(
  [selectTransactions],
  (transactions) => transactions.error
);

// Complex selectors with computed values
export const selectSortedTransactions = createSelector(
  [selectAllTransactions],
  (transactions) => {
    return [...transactions].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }
);

export const selectRecentTransactions = createSelector(
  [selectSortedTransactions],
  (transactions) => transactions.slice(0, 10)
);

export const selectTransactionsByType = createSelector(
  [selectAllTransactions],
  (transactions) => {
    return transactions.reduce((acc, transaction) => {
      const type = transaction.transaction_type || transaction.transactionType || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(transaction);
      return acc;
    }, {});
  }
);

export const selectTransactionSummary = createSelector(
  [selectAllTransactions],
  (transactions) => {
    const summary = {
      deposits: 0,
      withdrawals: 0,
      serviceCharges: 0,
      interests: 0,
      balance: 0,
      totalTransactions: transactions.length
    };

    transactions.forEach(transaction => {
      const amount = Number(transaction.amount) || 0;
      const type = (transaction.transaction_type || transaction.transactionType || '').toLowerCase();

      switch (type) {
        case 'deposit':
          summary.deposits += amount;
          summary.balance += amount;
          break;
        case 'withdrawal':
          summary.withdrawals += amount;
          summary.balance -= amount;
          break;
        case 'service_charge':
        case 'bankfee':
          summary.serviceCharges += amount;
          summary.balance -= amount;
          break;
        case 'interest':
          summary.interests += amount;
          summary.balance += amount;
          break;
        default:
          console.warn('Unknown transaction type:', type);
      }
    });

    return summary;
  }
);

export const selectMonthlyTransactionSummary = createSelector(
  [selectAllTransactions],
  (transactions) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyTransactions = transactions.filter(transaction => {
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate.getMonth() === currentMonth && 
             transactionDate.getFullYear() === currentYear;
    });

    return {
      count: monthlyTransactions.length,
      totalAmount: monthlyTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      transactions: monthlyTransactions
    };
  }
);

// User-specific selectors that can be used with parameters
export const makeSelectUserTransactions = () => createSelector(
  [selectAllTransactions, (state, userId) => userId],
  (transactions, userId) => {
    return transactions.filter(transaction => 
      transaction.userId === userId || transaction.user_id === userId
    );
  }
);

export const makeSelectTransactionsByDateRange = () => createSelector(
  [selectAllTransactions, (state, startDate, endDate) => ({ startDate, endDate })],
  (transactions, { startDate, endDate }) => {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.timestamp);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }
);

// Performance-optimized selectors for large datasets
export const selectTransactionsPaginated = createSelector(
  [selectSortedTransactions, (state, page, pageSize) => ({ page, pageSize })],
  (transactions, { page, pageSize }) => {
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    return {
      items: transactions.slice(startIndex, endIndex),
      totalItems: transactions.length,
      totalPages: Math.ceil(transactions.length / pageSize),
      currentPage: page
    };
  }
);

// Search and filter selectors
export const makeSelectFilteredTransactions = () => createSelector(
  [selectAllTransactions, (state, filters) => filters],
  (transactions, filters) => {
    return transactions.filter(transaction => {
      // Filter by search term
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const description = (transaction.description || '').toLowerCase();
        const type = (transaction.transaction_type || transaction.transactionType || '').toLowerCase();
        
        if (!description.includes(searchTerm) && !type.includes(searchTerm)) {
          return false;
        }
      }

      // Filter by transaction type
      if (filters.type && filters.type !== 'all') {
        const transactionType = (transaction.transaction_type || transaction.transactionType || '').toLowerCase();
        if (transactionType !== filters.type.toLowerCase()) {
          return false;
        }
      }

      // Filter by amount range
      if (filters.minAmount !== undefined && transaction.amount < filters.minAmount) {
        return false;
      }
      if (filters.maxAmount !== undefined && transaction.amount > filters.maxAmount) {
        return false;
      }

      // Filter by date range
      if (filters.startDate) {
        const transactionDate = new Date(transaction.timestamp);
        if (transactionDate < filters.startDate) {
          return false;
        }
      }
      if (filters.endDate) {
        const transactionDate = new Date(transaction.timestamp);
        if (transactionDate > filters.endDate) {
          return false;
        }
      }

      return true;
    });
  }
);

// Loading state combinators
export const selectIsLoading = createSelector(
  [selectAuthLoading, selectTransactionsLoading],
  (authLoading, transactionsLoading) => authLoading || transactionsLoading
);

export const selectHasErrors = createSelector(
  [selectAuthError, selectTransactionsError],
  (authError, transactionsError) => !!(authError || transactionsError)
);

export const selectAllErrors = createSelector(
  [selectAuthError, selectTransactionsError],
  (authError, transactionsError) => {
    const errors = [];
    if (authError) errors.push(authError);
    if (transactionsError) errors.push(transactionsError);
    return errors;
  }
);