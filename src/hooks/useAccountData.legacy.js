import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import { getUserData, subscribeToUserData, subscribeToTransactions } from '../services/userService';
import { processTransactionSummary } from '../services/apiService';
import useFirebaseSubscription from './useFirebaseSubscription';

/**
 * LEGACY: Original useAccountData hook for backward compatibility
 * This is the original working version before refactoring
 */
const useAccountDataLegacy = () => {
  const { user, isAdmin } = useUnifiedAuth();
  const navigate = useNavigate();
  const { user_id: initialTargetUserId } = useParams();
  
  // State management - make targetUserId reactive to URL changes
  const [targetUserId, setTargetUserId] = useState(initialTargetUserId || user?.uid);
  
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState(null);
  const [error, setError] = useState(null);

  // Update targetUserId when URL parameter changes
  useEffect(() => {
    const newTargetUserId = initialTargetUserId || user?.uid;
    if (newTargetUserId !== targetUserId) {
      setTargetUserId(newTargetUserId);
      // Reset data when switching users
      setUserData(null);
      setTransactions([]);
      setTransactionSummary(null);
      setError(null);
      setLoading(true);
    }
  }, [initialTargetUserId, user?.uid, targetUserId, isAdmin]);

  // Memoize current user ID calculation
  const currentUserId = useMemo(() => {
    return isAdmin ? targetUserId : user?.uid;
  }, [isAdmin, targetUserId, user?.uid]);

  // Initial data fetch when component mounts
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Admin can view other users, regular users can only view themselves
        if (!currentUserId) {
          throw new Error('No user identifier provided');
        }

        // Get user data by user_id
        let userData = await getUserData(currentUserId, user);
        
        if (!userData && !isAdmin) {
          // Only fallback to email for regular users (not admins viewing other users)
          userData = await getUserData(user.email, user);
        }

        if (userData) {
          // Merge database user data with auth data for profile info
          const enhancedUserData = {
            ...userData,
            user_id: userData.user_id
          };
          
          // If this is the current logged-in user, use their auth profile data
          if (currentUserId === user?.uid && user) {
            enhancedUserData.displayName = user.displayName || userData.displayName;
            enhancedUserData.photoURL = user.photoURL || userData.photoURL;
          }
          
          setUserData(enhancedUserData);
        } else {
          // More specific error message and don't throw on refresh - user data may load from subscription
          console.warn('Initial user data fetch returned null, waiting for subscription data...');
          setError('Loading user data...');
          // Don't throw error here - let the subscription handle it
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, navigate, targetUserId, currentUserId]);

  // Memoized subscription functions
  const createUserDataSubscription = useCallback(() => {
    if (!currentUserId) return null;
    
    return subscribeToUserData(currentUserId, (updatedUserData) => {
      if (updatedUserData) {
        setUserData(updatedUserData);
        setError(null);
        setLoading(false);
      } else {
        // Don't immediately set error on null data - could be temporary
        // Only set error if we've been explicitly waiting and auth is ready
        const currentTime = Date.now();
        setTimeout(() => {
          // Only show error if we still don't have data after reasonable time
          // and we're not in the middle of auth state changes
          setUserData(currentData => {
            if (!currentData && currentUserId) {
              setError('Loading user data...');
              // Don't set loading to false yet - keep trying
            }
            return currentData;
          });
        }, 2000); // Reduced timeout and changed message
      }
    });
  }, [currentUserId, userData]);

  // Setup user data subscription
  useFirebaseSubscription(createUserDataSubscription, [currentUserId]);
  
  // Transaction subscription setup
  useEffect(() => {
    if (!currentUserId) return;
    
    const unsubscribe = subscribeToTransactions(currentUserId, (updatedTransactions) => {
      setTransactions(updatedTransactions);
      const summary = processTransactionSummary(updatedTransactions);
      setTransactionSummary(summary);
      setError(null);
    }, user);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUserId, user]);
  

  // Function to refresh data manually
  const refreshData = useCallback(async () => {
    if (!currentUserId) return;
    
    try {
      setLoading(true);
      setError(null);
      const userData = await getUserData(currentUserId);
      if (userData) {
        setUserData(userData);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);


  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    userData,
    transactions,
    transactionSummary,
    
    // State
    loading,
    error,
    isAdmin,
    currentUserId,
    
    // Actions
    refreshData,
    setTargetUserId,
    
    // Navigation
    navigate
  }), [
    userData,
    transactions,
    transactionSummary,
    loading,
    error,
    isAdmin,
    currentUserId,
    refreshData,
    setTargetUserId,
    navigate
  ]);
};

export default useAccountDataLegacy;