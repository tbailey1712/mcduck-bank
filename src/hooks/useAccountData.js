import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import useUserData from './useUserData';
import useTransactions from './useTransactions';
import useTransactionSummary from './useTransactionSummary';

/**
 * Composition hook that combines user data, transactions, and summary
 * This is now a lightweight composition of focused hooks
 */
const useAccountData = () => {
  const { user, isAdmin, canAccessResource, isLoading: authLoading } = useAuthContext();
  const navigate = useNavigate();
  const { user_id: paramUserId } = useParams();
  
  // Determine which user's data to load
  const targetUserId = useMemo(() => {
    if (isAdmin && paramUserId) {
      return paramUserId; // Admin viewing specific user
    }
    return user?.uid; // Regular user viewing their own data
  }, [isAdmin, paramUserId, user?.uid]);

  // Check permissions - wait for auth to be ready
  const hasAccess = useMemo(() => {
    if (authLoading || !user) return false;
    if (!targetUserId) return false;
    return canAccessResource(targetUserId);
  }, [authLoading, user, canAccessResource, targetUserId]);

  // Only fetch data when we have proper access and targetUserId
  const shouldFetchData = hasAccess && targetUserId && !authLoading;
  
  // Always call hooks (hooks must be at top level)
  const userData = useUserData(shouldFetchData ? targetUserId : null, user);
  const transactions = useTransactions(shouldFetchData ? targetUserId : null, user);
  const transactionSummary = useTransactionSummary(transactions.transactions);

  // Handle navigation for access denied
  useEffect(() => {
    if (!authLoading && user && !hasAccess && targetUserId) {
      navigate('/auth');
    }
  }, [authLoading, user, hasAccess, targetUserId, navigate]);

  // If auth is still loading, show loading state
  if (authLoading) {
    return {
      loading: true,
      error: null,
      userData: null,
      transactions: [],
      transactionSummary: null,
      isAdmin,
      currentUserId: targetUserId,
      navigate
    };
  }

  // Handle access denied case
  if (!hasAccess && user) {
    return {
      loading: false,
      error: 'Access denied',
      userData: null,
      transactions: [],
      transactionSummary: null,
      isAdmin,
      currentUserId: targetUserId,
      navigate
    };
  }

  // Combine loading states
  const loading = userData.loading || transactions.loading;
  
  // Combine errors
  const error = userData.error || transactions.error;

  // Manual refresh function
  const refreshData = () => {
    userData.refetch();
    // Transactions will refresh automatically via subscription
  };

  return {
    // Data
    userData: userData.userData,
    transactions: transactions.transactions,
    sortedTransactions: transactions.sortedTransactions,
    recentTransactions: transactions.recentTransactions,
    transactionSummary: transactionSummary.summary,
    
    // State
    loading,
    error,
    isAdmin,
    currentUserId: targetUserId,
    
    // Computed values
    transactionCount: transactions.count,
    isEmpty: userData.isEmpty && transactions.isEmpty,
    isLoaded: userData.isLoaded && transactions.isLoaded,
    
    // Actions
    refreshData,
    
    // Navigation (for backward compatibility)
    navigate
  };
};

export default useAccountData;