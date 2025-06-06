/**
 * Unified Authentication Hook
 * Replaces multiple auth contexts with a single, comprehensive hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import unifiedAuthService from '../services/unifiedAuthService';
import PermissionService from '../services/permissionService';

/**
 * Main authentication hook
 */
export const useUnifiedAuth = () => {
  const [authState, setAuthState] = useState(() => {
    const currentAuth = unifiedAuthService.getCurrentAuth();
    return currentAuth || {
      isAuthenticated: false,
      user: null,
      isAdmin: false,
      permissions: [],
      loading: true,
      error: null
    };
  });

  // Set up auth state listener
  useEffect(() => {
    const unsubscribe = unifiedAuthService.addAuthListener((newAuthState) => {
      if (newAuthState?.error) {
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: newAuthState.error,
          isAuthenticated: false,
          user: null,
          isAdmin: false,
          permissions: []
        }));
      } else if (newAuthState) {
        setAuthState({
          isAuthenticated: newAuthState.isAuthenticated,
          user: newAuthState.user,
          isAdmin: newAuthState.isAdmin,
          permissions: newAuthState.permissions || [],
          claims: newAuthState.claims,
          sessionId: newAuthState.sessionId,
          lastActivity: newAuthState.lastActivity,
          loading: false,
          error: null
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isAdmin: false,
          permissions: [],
          loading: false,
          error: null
        });
      }
    });

    return unsubscribe;
  }, []);

  // Authentication actions
  const signOut = useCallback(async () => {
    try {
      await unifiedAuthService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      await unifiedAuthService.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }, []);

  // Permission helpers
  const hasPermission = useCallback((permission) => {
    return PermissionService.hasPermission(permission);
  }, [authState.permissions]);

  const hasAnyPermission = useCallback((permissions) => {
    return PermissionService.hasAnyPermission(permissions);
  }, [authState.permissions]);

  const hasAllPermissions = useCallback((permissions) => {
    return PermissionService.hasAllPermissions(permissions);
  }, [authState.permissions]);

  const canAccessResource = useCallback((resourceUserId) => {
    return PermissionService.canAccessResource(resourceUserId);
  }, [authState.user, authState.isAdmin]);

  // Admin actions (only available to admins)
  const setAdminClaims = useCallback(async (uid) => {
    if (!PermissionService.isAdmin()) {
      throw new Error('Admin privileges required');
    }
    return await unifiedAuthService.setAdminClaims(uid);
  }, [authState.isAdmin]);

  const removeAdminClaims = useCallback(async (uid) => {
    if (!PermissionService.isAdmin()) {
      throw new Error('Admin privileges required');
    }
    return await unifiedAuthService.removeAdminClaims(uid);
  }, [authState.isAdmin]);

  const initializeAdminUser = useCallback(async (email) => {
    return await unifiedAuthService.initializeAdminUser(email);
  }, []);

  // Computed values
  const computedValues = useMemo(() => ({
    // Basic auth info
    userId: authState.user?.uid,
    userEmail: authState.user?.email,
    displayName: authState.user?.displayName,
    photoURL: authState.user?.photoURL,
    
    // Status helpers
    isLoading: authState.loading,
    hasError: !!authState.error,
    isReady: !authState.loading && authState.isAuthenticated,
    
    // Permission helpers
    canReadUsers: PermissionService.canReadUserData(),
    canModifyUsers: PermissionService.canModifyUserData(),
    canReadTransactions: PermissionService.canReadTransactions(),
    canCreateTransactions: PermissionService.canCreateTransactions(),
    canUpdateTransactions: PermissionService.canUpdateTransactions(),
    canAccessAdminFeatures: PermissionService.canAccessAdminFeatures(),
    canManageUsers: PermissionService.canManageUsers(),
    canViewAuditLogs: PermissionService.canViewAuditLogs(),
    
    // UI permissions
    uiPermissions: PermissionService.getUIPermissions()
  }), [authState]);

  return {
    // Core auth state
    ...authState,
    
    // Computed values
    ...computedValues,
    
    // Actions
    signOut,
    refreshToken,
    
    // Permission checkers
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    
    // Admin actions
    setAdminClaims,
    removeAdminClaims,
    initializeAdminUser
  };
};

/**
 * Hook for checking specific permissions
 */
export const usePermissions = (requiredPermissions = []) => {
  const { permissions, hasPermission, hasAnyPermission, hasAllPermissions } = useUnifiedAuth();
  
  const permissionChecks = useMemo(() => {
    if (Array.isArray(requiredPermissions)) {
      return {
        hasAny: hasAnyPermission(requiredPermissions),
        hasAll: hasAllPermissions(requiredPermissions),
        individual: requiredPermissions.reduce((acc, permission) => {
          acc[permission] = hasPermission(permission);
          return acc;
        }, {})
      };
    }
    
    return {
      hasPermission: hasPermission(requiredPermissions)
    };
  }, [permissions, requiredPermissions, hasPermission, hasAnyPermission, hasAllPermissions]);
  
  return permissionChecks;
};

/**
 * Hook for admin-specific functionality
 */
export const useAdminAuth = () => {
  const auth = useUnifiedAuth();
  
  if (!auth.isAdmin) {
    return {
      isAdmin: false,
      adminActions: null,
      error: 'Admin privileges required'
    };
  }
  
  return {
    isAdmin: true,
    adminActions: {
      setAdminClaims: auth.setAdminClaims,
      removeAdminClaims: auth.removeAdminClaims,
      initializeAdminUser: auth.initializeAdminUser
    },
    canManageUsers: auth.canManageUsers,
    canViewAuditLogs: auth.canViewAuditLogs,
    canAccessSystemAdmin: PermissionService.canAccessSystemAdmin()
  };
};

/**
 * Hook for user session management
 */
export const useSession = () => {
  const { sessionId, lastActivity, refreshToken } = useUnifiedAuth();
  
  const extendSession = useCallback(() => {
    // Session is automatically extended by the unified auth service
    // This is mainly for manual session extension if needed
    refreshToken();
  }, [refreshToken]);
  
  const getSessionInfo = useCallback(() => {
    return {
      sessionId,
      lastActivity,
      isActive: Date.now() - (lastActivity || 0) < 30 * 60 * 1000 // 30 minutes
    };
  }, [sessionId, lastActivity]);
  
  return {
    sessionId,
    lastActivity,
    extendSession,
    getSessionInfo
  };
};

/**
 * Higher-order component for requiring authentication
 */
export const withUnifiedAuth = (WrappedComponent) => {
  const ComponentWithAuth = (props) => {
    const { isAuthenticated, isLoading } = useUnifiedAuth();
    
    if (isLoading) {
      return <div>Loading...</div>;
    }
    
    if (!isAuthenticated) {
      return <div>Authentication required</div>;
    }
    
    return <WrappedComponent {...props} />;
  };
  
  ComponentWithAuth.displayName = `withUnifiedAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithAuth;
};

/**
 * Higher-order component for requiring specific permissions
 */
export const withPermissions = (requiredPermissions, requireAll = false) => (WrappedComponent) => {
  const ComponentWithPermissions = (props) => {
    const { hasAnyPermission, hasAllPermissions, isLoading } = useUnifiedAuth();
    
    if (isLoading) {
      return <div>Loading...</div>;
    }
    
    const hasRequired = requireAll 
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
    
    if (!hasRequired) {
      return <div>Insufficient permissions</div>;
    }
    
    return <WrappedComponent {...props} />;
  };
  
  ComponentWithPermissions.displayName = `withPermissions(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithPermissions;
};

export default useUnifiedAuth;