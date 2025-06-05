import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing Firebase subscription cleanup
 * @param {Function} subscribeFunction - Function that returns an unsubscribe function
 * @param {Array} dependencies - Dependencies array for useEffect
 * @returns {Object} - Returns subscription status and cleanup function
 */
const useFirebaseSubscription = (subscribeFunction, dependencies = []) => {
  const unsubscribeRef = useRef(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    console.log('🔗 useFirebaseSubscription effect called:', {
      hasSubscribeFunction: !!subscribeFunction,
      isActive: isActiveRef.current,
      dependencies
    });
    
    // Cleanup any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Only subscribe if component is still active
    if (isActiveRef.current && subscribeFunction) {
      try {
        console.log('🚀 Calling subscribeFunction...');
        unsubscribeRef.current = subscribeFunction();
        console.log('✅ Subscription set up, unsubscribe function:', !!unsubscribeRef.current);
      } catch (error) {
        console.error('Error setting up Firebase subscription:', error);
      }
    } else {
      console.log('❌ Skipping subscription setup:', {
        isActive: isActiveRef.current,
        hasSubscribeFunction: !!subscribeFunction
      });
    }

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, dependencies);

  // Cleanup on unmount only
  useEffect(() => {
    isActiveRef.current = true; // Ensure it's active on mount
    return () => {
      isActiveRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);
  
  // Force reactivation when dependencies change
  useEffect(() => {
    isActiveRef.current = true;
  }, dependencies);

  // Manual cleanup function
  const cleanup = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  return { cleanup, isActive: isActiveRef.current };
};

export default useFirebaseSubscription;