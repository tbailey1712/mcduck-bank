import { useState, useEffect, useCallback, useMemo } from 'react';
import { subscribeToTransactions } from '../services/userService';
import useFirebaseSubscription from './useFirebaseSubscription';

/**
 * Hook for managing transaction data with real-time updates
 * Single responsibility: Transaction data management only
 */
const useTransactions = (userId, authUser = null) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Real-time subscription to transactions - bypass useFirebaseSubscription
  useEffect(() => {
    console.log('[useTransactions] useEffect called:', { userId, hasAuthUser: !!authUser });
    
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    setLoading(true);
    
    const unsubscribe = subscribeToTransactions(userId, (updatedTransactions) => {
      console.log('[useTransactions] Subscription callback:', { 
        userId, 
        hasTransactions: !!updatedTransactions, 
        count: updatedTransactions?.length 
      });
      setTransactions(updatedTransactions || []);
      setError(null);
      setLoading(false);
    }, authUser);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, authUser]);

  // Reset when userId changes
  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      setError(null);
    }
  }, [userId]);

  // Computed values
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return sortedTransactions.slice(0, 10);
  }, [sortedTransactions]);

  const transactionsByType = useMemo(() => {
    return transactions.reduce((acc, transaction) => {
      const type = transaction.transaction_type || transaction.transactionType || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(transaction);
      return acc;
    }, {});
  }, [transactions]);

  return {
    transactions,
    sortedTransactions,
    recentTransactions,
    transactionsByType,
    loading,
    error,
    // Computed stats
    count: transactions.length,
    isEmpty: transactions.length === 0,
    isLoaded: !loading
  };
};

export default useTransactions;