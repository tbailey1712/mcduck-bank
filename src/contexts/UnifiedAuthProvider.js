import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import unifiedAuthService from '../services/unifiedAuthService';

/**
 * Unified Authentication Context
 * Single source of truth for authentication state
 * Replaces both AuthProvider and AuthContext
 */
const UnifiedAuthContext = createContext(null);

export const UnifiedAuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => ({
    isAuthenticated: false,
    user: null,
    isAdmin: false,
    loading: true,
    error: null,
    sessionId: null
  }));

  // Update auth state from unified service
  const handleAuthStateChange = useCallback((newAuthState) => {
    if (newAuthState) {
      setAuthState(prevState => ({
        ...prevState,
        ...newAuthState,
        loading: false
      }));
    } else {
      setAuthState({
        isAuthenticated: false,
        user: null,
        isAdmin: false,
        loading: false,
        error: null,
        sessionId: null
      });
    }
  }, []);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = unifiedAuthService.addListener(handleAuthStateChange);
    
    // Get initial auth state
    const initialState = unifiedAuthService.getAuthState();
    if (initialState) {
      handleAuthStateChange(initialState);
    } else {
      setAuthState(prevState => ({ ...prevState, loading: false }));
    }

    return unsubscribe;
  }, [handleAuthStateChange]);

  // Auth actions
  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthState(prevState => ({ ...prevState, loading: true, error: null }));
      await unifiedAuthService.signInWithGoogle();
      // Auth state will be updated via the listener
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthState(prevState => ({
        ...prevState,
        loading: false,
        error: { message: error.message }
      }));
      throw error; // Re-throw for component error handling
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await unifiedAuthService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthState(prevState => ({
        ...prevState,
        error: { message: error.message }
      }));
    }
  }, []);

  const updateActivity = useCallback(() => {
    unifiedAuthService.updateActivity();
  }, []);

  // Permission helpers
  const hasPermission = useCallback((permission) => {
    return unifiedAuthService.hasPermission(permission);
  }, []);

  const canAccessResource = useCallback((resourceUserId) => {
    return unifiedAuthService.canAccessResource(resourceUserId);
  }, []);

  const getUserPermissions = useCallback(() => {
    return unifiedAuthService.getUserPermissions();
  }, []);

  // Context value
  const contextValue = {
    // Core auth state
    ...authState,
    
    // Computed values
    userId: authState.user?.uid,
    userEmail: authState.user?.email,
    displayName: authState.user?.displayName || authState.user?.name,
    
    // Permission helpers
    permissions: getUserPermissions(),
    hasPermission,
    canAccessResource,
    
    // Actions
    signInWithGoogle,
    signOut,
    updateActivity,
    
    // Status helpers
    isLoading: authState.loading,
    hasError: !!authState.error,
    isReady: !authState.loading && authState.isAuthenticated
  };

  return (
    <UnifiedAuthContext.Provider value={contextValue}>
      {children}
    </UnifiedAuthContext.Provider>
  );
};

UnifiedAuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

/**
 * Hook to access unified authentication context
 * @returns {Object} Authentication context value
 * @throws {Error} If used outside of UnifiedAuthProvider
 */
export const useUnifiedAuth = () => {
  const context = useContext(UnifiedAuthContext);
  
  if (context === null) {
    throw new Error('useUnifiedAuth must be used within a UnifiedAuthProvider');
  }
  
  return context;
};

/**
 * Higher-order component to require authentication
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Component that requires authentication
 */
export const withUnifiedAuth = (WrappedComponent) => {
  const ComponentWithAuth = React.memo((props) => {
    const { isAuthenticated, loading } = useUnifiedAuth();
    
    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px' 
        }}>
          Loading...
        </div>
      );
    }
    
    if (!isAuthenticated) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px',
          color: 'red'
        }}>
          Authentication required
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  });
  
  ComponentWithAuth.displayName = `withUnifiedAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithAuth;
};

/**
 * Higher-order component to require admin privileges
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Component that requires admin privileges
 */
export const withUnifiedAdmin = (WrappedComponent) => {
  const ComponentWithAdmin = React.memo((props) => {
    const { isAuthenticated, isAdmin, loading } = useUnifiedAuth();
    
    if (loading) {
      return <div>Loading...</div>;
    }
    
    if (!isAuthenticated) {
      return <div>Authentication required</div>;
    }
    
    if (!isAdmin) {
      return <div>Admin privileges required</div>;
    }
    
    return <WrappedComponent {...props} />;
  });
  
  ComponentWithAdmin.displayName = `withUnifiedAdmin(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithAdmin;
};

export default UnifiedAuthContext;