/**
 * Centralized Permission Service
 * Handles all role-based access control and permission checks
 */

import unifiedAuthService from './unifiedAuthService';

/**
 * Permission constants
 */
export const PERMISSIONS = {
  // User permissions
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  
  // Transaction permissions
  TRANSACTION_READ: 'transaction:read',
  TRANSACTION_CREATE: 'transaction:create',
  TRANSACTION_UPDATE: 'transaction:update',
  
  // Admin permissions
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
  
  // Admin user management
  ADMIN_USERS_READ: 'admin:users:read',
  ADMIN_USERS_WRITE: 'admin:users:write',
  
  // Admin transaction management
  ADMIN_TRANSACTIONS_READ: 'admin:transactions:read',
  ADMIN_TRANSACTIONS_WRITE: 'admin:transactions:write',
  
  // System administration
  ADMIN_SYSTEM_READ: 'admin:system:read',
  ADMIN_SYSTEM_WRITE: 'admin:system:write',
  
  // Audit log access
  ADMIN_AUDIT_READ: 'admin:audit:read',
  ADMIN_AUDIT_WRITE: 'admin:audit:write'
};

/**
 * Role definitions
 */
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

/**
 * Role to permissions mapping
 */
const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.TRANSACTION_READ,
    PERMISSIONS.TRANSACTION_CREATE
  ],
  [ROLES.ADMIN]: [
    // Include all user permissions
    ...ROLE_PERMISSIONS[ROLES.USER] || [],
    // Add admin-specific permissions
    PERMISSIONS.ADMIN_READ,
    PERMISSIONS.ADMIN_WRITE,
    PERMISSIONS.ADMIN_USERS_READ,
    PERMISSIONS.ADMIN_USERS_WRITE,
    PERMISSIONS.ADMIN_TRANSACTIONS_READ,
    PERMISSIONS.ADMIN_TRANSACTIONS_WRITE,
    PERMISSIONS.ADMIN_SYSTEM_READ,
    PERMISSIONS.ADMIN_SYSTEM_WRITE,
    PERMISSIONS.ADMIN_AUDIT_READ,
    PERMISSIONS.ADMIN_AUDIT_WRITE,
    PERMISSIONS.TRANSACTION_UPDATE
  ]
};

/**
 * Permission checking utilities
 */
class PermissionService {
  /**
   * Check if current user has specific permission
   */
  static hasPermission(permission) {
    const currentAuth = unifiedAuthService.getCurrentAuth();
    if (!currentAuth?.isAuthenticated) return false;
    
    return currentAuth.permissions?.includes(permission) || false;
  }

  /**
   * Check if current user has any of the specified permissions
   */
  static hasAnyPermission(permissions) {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if current user has all of the specified permissions
   */
  static hasAllPermissions(permissions) {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Check if current user has specific role
   */
  static hasRole(role) {
    const currentAuth = unifiedAuthService.getCurrentAuth();
    if (!currentAuth?.isAuthenticated) return false;
    
    if (role === ROLES.ADMIN) {
      return currentAuth.isAdmin === true;
    }
    
    if (role === ROLES.USER) {
      return currentAuth.isAuthenticated;
    }
    
    return false;
  }

  /**
   * Get all permissions for current user
   */
  static getCurrentPermissions() {
    const currentAuth = unifiedAuthService.getCurrentAuth();
    return currentAuth?.permissions || [];
  }

  /**
   * Get permissions for a specific role
   */
  static getPermissionsForRole(role) {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if user can access resource owned by another user
   */
  static canAccessResource(resourceUserId) {
    return unifiedAuthService.canAccessResource(resourceUserId);
  }

  /**
   * Check if user can read other users' data
   */
  static canReadUserData(targetUserId = null) {
    // Admins can read all user data
    if (this.hasPermission(PERMISSIONS.ADMIN_USERS_READ)) {
      return true;
    }
    
    // Users can only read their own data
    if (targetUserId) {
      return this.canAccessResource(targetUserId);
    }
    
    return this.hasPermission(PERMISSIONS.USER_READ);
  }

  /**
   * Check if user can modify other users' data
   */
  static canModifyUserData(targetUserId = null) {
    // Admins can modify all user data
    if (this.hasPermission(PERMISSIONS.ADMIN_USERS_WRITE)) {
      return true;
    }
    
    // Users can only modify their own data
    if (targetUserId) {
      return this.canAccessResource(targetUserId);
    }
    
    return this.hasPermission(PERMISSIONS.USER_UPDATE);
  }

  /**
   * Check if user can read transactions
   */
  static canReadTransactions(ownerUserId = null) {
    // Admins can read all transactions
    if (this.hasPermission(PERMISSIONS.ADMIN_TRANSACTIONS_READ)) {
      return true;
    }
    
    // Users can read their own transactions
    if (ownerUserId) {
      return this.canAccessResource(ownerUserId);
    }
    
    return this.hasPermission(PERMISSIONS.TRANSACTION_READ);
  }

  /**
   * Check if user can create transactions
   */
  static canCreateTransactions(targetUserId = null) {
    // Admins can create transactions for any user
    if (this.hasPermission(PERMISSIONS.ADMIN_TRANSACTIONS_WRITE)) {
      return true;
    }
    
    // Users can create transactions for themselves
    if (targetUserId) {
      return this.canAccessResource(targetUserId);
    }
    
    return this.hasPermission(PERMISSIONS.TRANSACTION_CREATE);
  }

  /**
   * Check if user can update/approve transactions
   */
  static canUpdateTransactions() {
    return this.hasPermission(PERMISSIONS.TRANSACTION_UPDATE);
  }

  /**
   * Check if user can access admin features
   */
  static canAccessAdminFeatures() {
    return this.hasPermission(PERMISSIONS.ADMIN_READ);
  }

  /**
   * Check if user can modify admin settings
   */
  static canModifyAdminSettings() {
    return this.hasPermission(PERMISSIONS.ADMIN_WRITE);
  }

  /**
   * Check if user can manage other users
   */
  static canManageUsers() {
    return this.hasPermission(PERMISSIONS.ADMIN_USERS_WRITE);
  }

  /**
   * Check if user can view audit logs
   */
  static canViewAuditLogs() {
    return this.hasPermission(PERMISSIONS.ADMIN_AUDIT_READ);
  }

  /**
   * Check if user can access system administration
   */
  static canAccessSystemAdmin() {
    return this.hasPermission(PERMISSIONS.ADMIN_SYSTEM_READ);
  }

  /**
   * Get current user info
   */
  static getCurrentUser() {
    const currentAuth = unifiedAuthService.getCurrentAuth();
    return currentAuth?.user || null;
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated() {
    const currentAuth = unifiedAuthService.getCurrentAuth();
    return currentAuth?.isAuthenticated || false;
  }

  /**
   * Check if user is admin
   */
  static isAdmin() {
    return this.hasRole(ROLES.ADMIN);
  }

  /**
   * Validate permission string format
   */
  static isValidPermission(permission) {
    return Object.values(PERMISSIONS).includes(permission);
  }

  /**
   * Get user's role-based access level
   */
  static getAccessLevel() {
    if (this.isAdmin()) return 'admin';
    if (this.isAuthenticated()) return 'user';
    return 'guest';
  }

  /**
   * Create permission check decorator for functions
   */
  static requirePermission(permission) {
    return function(target, propertyKey, descriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = function(...args) {
        if (!PermissionService.hasPermission(permission)) {
          throw new Error(`Permission denied: ${permission} required`);
        }
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }

  /**
   * Create role check decorator for functions
   */
  static requireRole(role) {
    return function(target, propertyKey, descriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = function(...args) {
        if (!PermissionService.hasRole(role)) {
          throw new Error(`Role required: ${role}`);
        }
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }

  /**
   * Get contextual permissions for UI rendering
   */
  static getUIPermissions() {
    return {
      // Navigation permissions
      showAdminMenu: this.canAccessAdminFeatures(),
      showUserMenu: this.isAuthenticated(),
      
      // Page access permissions
      canAccessDashboard: this.isAuthenticated(),
      canAccessProfile: this.isAuthenticated(),
      canAccessTransactions: this.isAuthenticated(),
      canAccessAdminPanel: this.canAccessAdminFeatures(),
      canAccessUserManagement: this.canManageUsers(),
      canAccessAuditLogs: this.canViewAuditLogs(),
      canAccessSystemSettings: this.canAccessSystemAdmin(),
      
      // Action permissions
      canCreateTransactions: this.canCreateTransactions(),
      canApproveTransactions: this.canUpdateTransactions(),
      canModifyUsers: this.canManageUsers(),
      canViewAllTransactions: this.hasPermission(PERMISSIONS.ADMIN_TRANSACTIONS_READ),
      
      // Current user context
      currentUser: this.getCurrentUser(),
      isAdmin: this.isAdmin(),
      accessLevel: this.getAccessLevel()
    };
  }
}

export default PermissionService;
export { ROLE_PERMISSIONS };