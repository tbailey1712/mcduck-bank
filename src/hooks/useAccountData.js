import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import useUserData from './useUserData';
import useTransactions from './useTransactions';
import useTransactionSummary from './useTransactionSummary';

/**
 * Composition hook that combines user data, transactions, and summary
 * This is now a lightweight composition of focused hooks
 */
const useAccountData = () => {
  const { user, isAdmin, canAccessResource, loading: authLoading } = useUnifiedAuth();
  const navigate = useNavigate();
  const { user_id: paramUserId } = useParams();
  
  // Determine which user's data to load
  // Account docs are keyed by UID (post-migration)
  const targetUserId = useMemo(() => {
    if (isAdmin && paramUserId) {
      return paramUserId; // Admin viewing specific user
    }
    return user?.uid; // Regular user viewing their own data
  }, [isAdmin, paramUserId, user?.uid]);

  // Check permissions - wait for auth to be ready
  const hasAccess = useMemo(() => {
    // Wait for auth to be fully ready
    if (authLoading || !user || !user.uid) {
      return false;
    }
    
    if (!targetUserId) {
      return false;
    }
    
    // For regular users viewing their own account (/account route), allow access
    if (!paramUserId && targetUserId === user.uid) {
      return true;
    }
    
    // For all other cases (admin accessing other users), use canAccessResource
    return canAccessResource(targetUserId);
  }, [authLoading, user, canAccessResource, targetUserId, paramUserId]);

  // Only fetch data when we have proper access and targetUserId
  const shouldFetchData = hasAccess && targetUserId && !authLoading;
  
  // Always call hooks (hooks must be at top level)
  // Both accounts and transactions are keyed by UID
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

  const result = {
    // Data - Return hook data directly
    userData: userData,
    transactions: transactions.transactions,
    sortedTransactions: transactions.sortedTransactions,
    recentTransactions: transactions.recentTransactions,
    transactionSummary,
    
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
  
  console.log('[useAccountData] Final result:', {
    hasUserData: !!result.userData?.userData,
    userDataLoading: result.userData?.loading,
    userDataError: result.userData?.error,
    transactionsLoading: transactions.loading,
    transactionsError: transactions.error,
    combinedLoading: result.loading,
    error: result.error,
    targetUserId: targetUserId,
    userUid: user?.uid,
    shouldFetchData
  });
  
  return result;
};

export default useAccountData;