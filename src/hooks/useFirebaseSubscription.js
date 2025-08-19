import { useEffect, useRef } from 'react';
import { isEqual } from 'lodash';

const useFirebaseSubscription = (subscribeFunction, dependencies = []) => {
  const unsubscribeRef = useRef(null);
  const isActiveRef = useRef(true);
  const dependenciesRef = useRef(null); // Initialize as null to force first subscription

  useEffect(() => {
    if (isEqual(dependenciesRef.current, dependencies)) {
      return;
    }
    dependenciesRef.current = dependencies;
    
    // Cleanup any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Only subscribe if component is still active
    if (isActiveRef.current && subscribeFunction) {
      try {
        unsubscribeRef.current = subscribeFunction();
      } catch (error) {
        console.error('Error setting up Firebase subscription:', error);
      }
    }

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [subscribeFunction, dependencies]);

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