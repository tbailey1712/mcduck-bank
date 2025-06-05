import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * Simplified test version of useAccountData to debug the issue
 * This version only focuses on the auth context integration
 */
const useAccountDataTest = () => {
  const navigate = useNavigate();
  const { user_id: paramUserId } = useParams();
  const [error, setError] = useState(null);
  
  // Always call hooks at top level - no conditional calls
  const authContextData = useAuthContext();
  
  const { user, isAdmin, canAccessResource, isLoading: authLoading } = authContextData;
  
  console.log('🔍 AuthContext values:', {
    user: user?.uid,
    isAdmin,
    authLoading,
    paramUserId,
    hasError: !!error
  });
  
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
    try {
      return canAccessResource(targetUserId);
    } catch (err) {
      console.error('❌ Error in canAccessResource:', err);
      return false;
    }
  }, [authLoading, user, canAccessResource, targetUserId]);

  console.log('🔍 Access check:', {
    targetUserId,
    hasAccess,
    authLoading
  });

  // Return minimal state for testing
  return {
    loading: authLoading,
    error: error,
    userData: null,
    transactions: [],
    transactionSummary: null,
    isAdmin,
    currentUserId: targetUserId,
    navigate
  }
};

export default useAccountDataTest;