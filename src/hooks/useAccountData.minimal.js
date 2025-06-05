import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/selectors';

/**
 * Minimal test hook - just Redux data, no Firebase calls
 */
const useAccountDataMinimal = () => {
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

  console.log('useAccountDataMinimal:', {
    user: user?.uid,
    targetUserId,
    currentUserId,
    isAdmin,
    paramUserId
  });

  // Return mock data to test if the basic structure works
  return {
    // Data - all null/empty for now
    userData: {
      user_id: currentUserId,
      displayName: user?.displayName || 'Test User',
      email: user?.email || 'test@example.com'
    },
    transactions: [],
    transactionSummary: {
      balance: 0,
      deposits: 0,
      withdrawals: 0
    },
    
    // State
    loading: false, // Not loading since no Firebase calls
    error: null,
    isAdmin,
    currentUserId,
    
    // Actions
    refreshData: () => console.log('refresh called'),
    
    // Navigation
    navigate
  };
};

export default useAccountDataMinimal;