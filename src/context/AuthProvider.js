import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { db } from '../config/firebaseConfig';
import { getUserData } from '../services/userService';
import { setDoc, doc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(() => {
    const token = localStorage.getItem('sessionToken') || uuidv4();
    localStorage.setItem('sessionToken', token);
    return token;
  });
  const [isHandlingAuthChange, setIsHandlingAuthChange] = useState(false);
  const auth = getAuth();

  const checkAuthState = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Verify token freshness
        const idTokenResult = await currentUser.getIdTokenResult();
        const tokenAge = Date.now() - idTokenResult.issuedAtTime;
        
        if (tokenAge > 30 * 60 * 1000) { // 30 minutes
          await currentUser.getIdToken(true); // Force refresh
        }

        const userData = await getUserData(currentUser.email);
        if (userData) {
          // Update last login time
          await setDoc(doc(db, 'accounts', userData.user_id), {
            lastLogin: new Date().toISOString(),
            lastIp: window.location.hostname,
            lastSessionToken: sessionToken
          }, { merge: true });

          // Only update auth state if it's different
          if (!authState || authState.uid !== userData.user_id) {
            setAuthState({
              user: {
                uid: userData.user_id,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                administrator: userData.administrator
              },
              isAdmin: userData.administrator,
              uid: userData.user_id,
              sessionToken: sessionToken
            });
          }
        } else {
          setAuthState(null);
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      setAuthState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial auth check
    checkAuthState();

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && !isHandlingAuthChange) {
        // Only handle auth changes if we're not already handling one
        setIsHandlingAuthChange(true);
        try {
          await checkAuthState();
        } finally {
          setIsHandlingAuthChange(false);
        }
      } else if (!user) {
        // User is signed out
        setAuthState(null);
      }
    });

    // Listen for token changes
    const tokenUnsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await checkAuthState();
      }
    });

    return () => {
      authUnsubscribe();
      tokenUnsubscribe();
    };
  }, []); // Empty dependency array to prevent infinite loop

  useEffect(() => {
    if (authState) {
      setLoading(false);
    }
  }, [authState]);

  const logout = async () => {
    try {
      await auth.signOut();
      setAuthState(null);
      localStorage.removeItem('sessionToken');
      setSessionToken(() => {
        const newToken = uuidv4();
        localStorage.setItem('sessionToken', newToken);
        return newToken;
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        authState, 
        loading,
        logout,
        isAuthenticated: !!authState,
        isAdmin: authState?.isAdmin || false,
        navigate: (path) => {
          // Only navigate if we have a valid path and we're not already there
          if (path && window.location.pathname !== path) {
            window.location.href = path;
          }
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
