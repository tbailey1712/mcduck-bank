import { useState, useEffect, useCallback } from 'react';
import { getUserData, subscribeToUserData } from '../services/userService';
import useFirebaseSubscription from './useFirebaseSubscription';

/**
 * Hook for managing user data with real-time updates
 * Single responsibility: User data management only
 */
const useUserData = (userId, authUser = null) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  

  // Fetch user data initially
  const fetchUserData = useCallback(async () => {
    console.log('[useUserData] fetchUserData called:', { userId, hasAuthUser: !!authUser });
    
    if (!userId) {
      console.log('[useUserData] No userId, clearing data');
      setUserData(null);
      return;
    }

    setLoading(true);
    setError(null);
    console.log('[useUserData] Starting fetch...');

    try {
      const data = await getUserData(userId, authUser);
      console.log('[useUserData] Fetch result:', { hasData: !!data, data });
      setUserData(data);
    } catch (err) {
      console.error('[useUserData] Fetch error:', err);
      setError(err.message || 'Failed to fetch user data');
      setUserData(null);
    } finally {
      setLoading(false);
      console.log('[useUserData] Fetch completed, loading set to false');
    }
  }, [userId, authUser]);

  // Initial fetch
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Real-time subscription
  const createSubscription = useCallback(() => {
    if (!userId) return null;
    
    return subscribeToUserData(userId, (updatedUserData) => {
      if (updatedUserData) {
        setUserData(updatedUserData);
        setError(null);
      }
    }, authUser);
  }, [userId, authUser]);

  // Setup subscription with cleanup
  useFirebaseSubscription(createSubscription, [userId]);

  // Manual refresh function
  const refetch = useCallback(() => {
    fetchUserData();
  }, [fetchUserData]);

  return {
    userData,
    loading,
    error,
    refetch,
    // Computed values for convenience
    isLoaded: !loading && userData !== null,
    isEmpty: !loading && userData === null
  };
};

export default useUserData;