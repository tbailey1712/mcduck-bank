import React, { createContext, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsAdmin, selectAuthLoading, selectAuthError } from '../store/selectors';

/**
 * Authentication Context
 * Provides a clean interface to auth state without direct Redux coupling
 */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin = useSelector(selectIsAdmin);
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => {
    // Helper function to get user permissions
    const getUserPermissions = () => {
      if (!user) return [];
      
      const permissions = ['user:read', 'user:update'];
      
      if (isAdmin) {
        permissions.push(
          'admin:read',
          'admin:write', 
          'admin:users:read',
          'admin:users:write',
          'admin:transactions:read',
          'admin:transactions:write'
        );
      }
      
      return permissions;
    };

    // Helper function to check if user has specific permission
    const hasPermission = (permission) => {
      const permissions = getUserPermissions();
      return permissions.includes(permission);
    };

    // Helper function to check if user can access resource
    const canAccessResource = (resourceUserId) => {
      if (!isAuthenticated) return false;
      if (isAdmin) return true; // Admins can access any resource
      return user?.uid === resourceUserId; // Users can only access their own resources
    };

    return {
      // Core auth state
      user,
      isAuthenticated,
      isAdmin,
      loading,
      error,
      
      // Computed values
      userId: user?.uid,
      userEmail: user?.email,
      displayName: user?.displayName || user?.name,
      
      // Permission helpers
      permissions: getUserPermissions(),
      hasPermission,
      canAccessResource,
      
      // Status helpers
      isLoading: loading,
      hasError: !!error,
      isReady: !loading && isAuthenticated
    };
  }, [user, isAuthenticated, isAdmin, loading, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

/**
 * Hook to access authentication context
 * @returns {Object} Authentication context value
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  
  if (context === null) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * Higher-order component to require authentication
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Component that requires authentication
 */
export const withAuth = (WrappedComponent) => {
  const ComponentWithAuth = React.memo((props) => {
    const { isAuthenticated, loading } = useAuthContext();
    
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
      // In a real app, you might want to redirect here
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
  
  ComponentWithAuth.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithAuth;
};

/**
 * Higher-order component to require admin privileges
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Component that requires admin privileges
 */
export const withAdmin = (WrappedComponent) => {
  const ComponentWithAdmin = React.memo((props) => {
    const { isAuthenticated, isAdmin, loading } = useAuthContext();
    
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
  
  ComponentWithAdmin.displayName = `withAdmin(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithAdmin;
};

export default AuthContext;