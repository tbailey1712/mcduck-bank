import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/selectors';
import useUserData from './useUserData';
import useTransactions from './useTransactions';
import useTransactionSummary from './useTransactionSummary';

/**
 * Fixed composition hook that works like the legacy version
 * but uses the new focused hooks
 */
const useAccountDataFixed = () => {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const { user_id: paramUserId } = useParams();
  const isAdmin = user?.isAdmin || user?.administrator;
  
  // Determine which user's data to load (same logic as legacy)
  const targetUserId = useMemo(() => {
    return isAdmin ? paramUserId : user?.uid;
  }, [isAdmin, paramUserId, user?.uid]);

  // Get current user ID for data fetching (same logic as legacy)
  const currentUserId = useMemo(() => {
    return isAdmin ? targetUserId : user?.uid;
  }, [isAdmin, targetUserId, user?.uid]);

  // Debug logging
  console.log('useAccountDataFixed debug:', {
    user: user?.uid,
    targetUserId,
    currentUserId,
    isAdmin,
    paramUserId
  });

  // Handle navigation (same as legacy)
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
  }, [user, navigate]);

  // Always call hooks (pass currentUserId directly to both)
  const userData = useUserData(currentUserId, user);
  const transactions = useTransactions(currentUserId, user);
  const transactionSummary = useTransactionSummary(transactions.transactions);

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
    currentUserId,
    
    // Computed values
    transactionCount: transactions.count,
    isEmpty: userData.isEmpty && transactions.isEmpty,
    isLoaded: userData.isLoaded && transactions.isLoaded,
    
    // Actions
    refreshData,
    setTargetUserId: () => {}, // For compatibility
    
    // Navigation (for backward compatibility)
    navigate
  };
};

export default useAccountDataFixed;