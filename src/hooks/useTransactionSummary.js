import { useMemo } from 'react';
import { processTransactionSummary } from '../services/apiService';

/**
 * Hook for computing transaction summary from transaction data
 * Single responsibility: Transaction summary computation
 */
const useTransactionSummary = (transactions = []) => {
  // Memoize summary calculation to avoid recomputation on every render
  const summary = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        deposits: 0,
        withdrawals: 0,
        serviceCharges: 0,
        interests: 0,
        balance: 0,
        totalTransactions: 0,
        netActivity: 0,
        lastTransactionDate: null
      };
    }

    const baseSummary = processTransactionSummary(transactions);
    
    // Add additional computed fields
    const netActivity = baseSummary.deposits + baseSummary.interests - baseSummary.withdrawals - baseSummary.serviceCharges;
    
    // Find last transaction date
    const lastTransactionDate = transactions.reduce((latest, transaction) => {
      const transactionDate = new Date(transaction.timestamp);
      return !latest || transactionDate > latest ? transactionDate : latest;
    }, null);

    return {
      ...baseSummary,
      netActivity,
      lastTransactionDate,
      totalTransactions: transactions.length
    };
  }, [transactions]);

  // Additional computed properties
  const metrics = useMemo(() => ({
    averageTransactionAmount: summary.totalTransactions > 0 
      ? (summary.deposits + summary.withdrawals) / summary.totalTransactions 
      : 0,
    
    depositWithdrawalRatio: summary.withdrawals > 0 
      ? summary.deposits / summary.withdrawals 
      : summary.deposits > 0 ? Infinity : 0,
    
    isPositiveBalance: summary.balance > 0,
    
    hasRecentActivity: summary.lastTransactionDate 
      ? (Date.now() - summary.lastTransactionDate.getTime()) < (7 * 24 * 60 * 60 * 1000) // 7 days
      : false,
    
    monthlyAverage: summary.totalTransactions > 0 && summary.lastTransactionDate
      ? calculateMonthlyAverage(transactions, summary.lastTransactionDate)
      : 0
  }), [summary, transactions]);

  return {
    summary,
    metrics,
    // Quick access to common values
    balance: summary.balance,
    totalTransactions: summary.totalTransactions,
    isLoaded: transactions.length >= 0 // Always true once we have data (even if empty)
  };
};

// Helper function to calculate monthly transaction average
const calculateMonthlyAverage = (transactions, lastDate) => {
  if (!transactions.length || !lastDate) return 0;
  
  const firstDate = transactions.reduce((earliest, transaction) => {
    const transactionDate = new Date(transaction.timestamp);
    return !earliest || transactionDate < earliest ? transactionDate : earliest;
  }, null);
  
  if (!firstDate) return 0;
  
  const monthsDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
  return transactions.length / monthsDiff;
};

export default useTransactionSummary;