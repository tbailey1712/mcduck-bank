/**
 * Unified Authentication Service
 * Consolidates Firebase Auth with custom claims and session management
 * Replaces the dual auth system with a single source of truth
 */

import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getUserData } from './userService';
import auditService, { AUDIT_EVENTS } from './auditService';
import { sanitizeObject } from '../utils/validation';
import firebaseApp from '../config/firebaseConfig';

// Session management constants
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const SESSION_KEY = 'mcduck_session';

/**
 * Secure session storage with encryption-like obfuscation
 */
class SecureSessionManager {
  constructor() {
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  encodeSession(data) {
    try {
      const encoded = btoa(JSON.stringify({
        ...data,
        timestamp: Date.now(),
        sessionId: this.sessionId
      }));
      return encoded;
    } catch (error) {
      console.warn('Failed to encode session data:', error);
      return null;
    }
  }

  decodeSession(encoded) {
    try {
      const decoded = JSON.parse(atob(encoded));
      
      // Check session expiration
      if (Date.now() - decoded.timestamp > SESSION_DURATION) {
        console.warn('Session expired');
        this.clearSession();
        return null;
      }
      
      return decoded;
    } catch (error) {
      console.warn('Failed to decode session data:', error);
      return null;
    }
  }

  setSession(authData) {
    try {
      const encoded = this.encodeSession(authData);
      if (encoded) {
        localStorage.setItem(SESSION_KEY, encoded);
        sessionStorage.setItem(SESSION_KEY, encoded);
      }
    } catch (error) {
      console.warn('Failed to store session:', error);
    }
  }

  getSession() {
    try {
      const encoded = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (encoded) {
        return this.decodeSession(encoded);
      }
    } catch (error) {
      console.warn('Failed to retrieve session:', error);
    }
    return null;
  }

  clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      // Clear any legacy session data
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('mcduck_auth_state');
      sessionStorage.removeItem('mcduck_auth_state');
    } catch (error) {
      console.warn('Failed to clear session:', error);
    }
  }

  extendSession() {
    const currentSession = this.getSession();
    if (currentSession) {
      this.setSession(currentSession);
    }
  }
}

/**
 * Unified Authentication Manager
 */
class UnifiedAuthService {
  constructor() {
    this.auth = getAuth();
    this.functions = getFunctions(firebaseApp, 'us-central1');
    this.sessionManager = new SecureSessionManager();
    this.currentUser = null;
    this.authListeners = new Set();
    this.refreshTokenTimer = null;
    
    this.initializeAuthListener();
    this.setupTokenRefresh();
  }

  /**
   * Add authentication state listener
   */
  addAuthListener(callback) {
    this.authListeners.add(callback);
    
    // Immediately call with current state if available
    if (this.currentUser !== null) {
      callback(this.currentUser);
    }
    
    return () => this.authListeners.delete(callback);
  }

  /**
   * Notify all listeners of auth state changes
   */
  notifyListeners(authState) {
    this.authListeners.forEach(callback => {
      try {
        callback(authState);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  /**
   * Initialize Firebase auth state listener
   */
  initializeAuthListener() {
    return onAuthStateChanged(this.auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await this.handleUserAuthenticated(firebaseUser);
        } else {
          await this.handleUserSignedOut();
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        await this.handleAuthError(error);
      }
    });
  }

  /**
   * Handle authenticated user
   */
  async handleUserAuthenticated(firebaseUser) {
    try {
      console.log('🔐 Processing authenticated user:', firebaseUser.email);
      
      // Get fresh ID token with custom claims
      const idTokenResult = await firebaseUser.getIdTokenResult();
      
      // Get user data from database
      const userData = await getUserData(firebaseUser.email);
      
      if (!userData) {
        console.log('❌ User not authorized - no account found');
        await this.signOut();
        throw new Error('Access denied. You do not have an authorized account.');
      }

      // Create unified auth state
      const authState = {
        isAuthenticated: true,
        user: {
          uid: userData.user_id,
          email: userData.email,
          displayName: firebaseUser.displayName || userData.displayName || userData.name,
          photoURL: firebaseUser.photoURL || userData.photoURL,
          emailVerified: firebaseUser.emailVerified,
          administrator: userData.administrator
        },
        // Use custom claims OR database field for admin status (hybrid approach)
        isAdmin: idTokenResult.claims.administrator === true || userData.administrator === true,
        permissions: this.calculatePermissions(idTokenResult.claims, userData),
        claims: idTokenResult.claims,
        tokenIssuedAt: idTokenResult.issuedAtTime,
        tokenExpiresAt: idTokenResult.expirationTime,
        sessionId: this.sessionManager.sessionId,
        lastActivity: Date.now()
      };

      // Sanitize the auth state before storing
      const sanitizedAuthState = sanitizeObject(authState);

      // Store session securely
      this.sessionManager.setSession(sanitizedAuthState);
      
      // Update current user
      this.currentUser = sanitizedAuthState;
      
      // Log successful authentication
      await this.logAuthEvent(AUDIT_EVENTS.LOGIN_SUCCESS, sanitizedAuthState.user, {
        login_method: 'google_oauth',
        token_issued_at: idTokenResult.issuedAtTime,
        session_id: this.sessionManager.sessionId,
        admin_status: sanitizedAuthState.isAdmin
      });

      // Notify listeners
      this.notifyListeners(sanitizedAuthState);
      
      console.log('✅ Authentication completed successfully');
      
    } catch (error) {
      console.error('Error handling authenticated user:', error);
      throw error;
    }
  }

  /**
   * Handle user signed out
   */
  async handleUserSignedOut() {
    console.log('🚪 User signed out');
    
    // Log logout if we had a current user
    if (this.currentUser?.user) {
      await this.logAuthEvent(AUDIT_EVENTS.LOGOUT, this.currentUser.user, {
        logout_method: 'automatic',
        session_duration: Date.now() - (this.currentUser.lastActivity || Date.now())
      });
    }
    
    // Clear session
    this.sessionManager.clearSession();
    
    // Update current user
    this.currentUser = null;
    
    // Clear token refresh timer
    if (this.refreshTokenTimer) {
      clearInterval(this.refreshTokenTimer);
      this.refreshTokenTimer = null;
    }
    
    // Notify listeners
    this.notifyListeners(null);
  }

  /**
   * Handle authentication errors
   */
  async handleAuthError(error) {
    console.error('Authentication error:', error);
    
    // Clear any existing session
    this.sessionManager.clearSession();
    this.currentUser = null;
    
    // Notify listeners with error
    this.notifyListeners({ error: error.message });
  }

  /**
   * Calculate user permissions based on claims and user data
   */
  calculatePermissions(claims, userData) {
    const permissions = ['user:read', 'user:update'];
    
    // Check both custom claims AND database field for admin status
    if (claims.administrator === true || userData.administrator === true) {
      permissions.push(
        'admin:read',
        'admin:write',
        'admin:users:read',
        'admin:users:write',
        'admin:transactions:read',
        'admin:transactions:write',
        'admin:system:read',
        'admin:system:write'
      );
    }
    
    return permissions;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    return this.currentUser?.permissions?.includes(permission) || false;
  }

  /**
   * Check if user can access specific resource
   */
  canAccessResource(resourceUserId) {
    if (!this.currentUser?.isAuthenticated) return false;
    if (this.currentUser.isAdmin) return true;
    return this.currentUser.user?.uid === resourceUserId;
  }

  /**
   * Get current authentication state
   */
  getCurrentAuth() {
    return this.currentUser;
  }

  /**
   * Sign out user
   */
  async signOut() {
    try {
      // Log logout event before signing out
      if (this.currentUser?.user) {
        await this.logAuthEvent(AUDIT_EVENTS.LOGOUT, this.currentUser.user, {
          logout_method: 'manual',
          session_duration: Date.now() - (this.currentUser.lastActivity || Date.now())
        });
      }
      
      await signOut(this.auth);
      
    } catch (error) {
      console.error('Error signing out:', error);
      // Still clear local state even if Firebase signOut fails
      await this.handleUserSignedOut();
      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken() {
    try {
      const user = this.auth.currentUser;
      if (user) {
        const idTokenResult = await user.getIdTokenResult(true); // Force refresh
        
        if (this.currentUser) {
          this.currentUser.tokenIssuedAt = idTokenResult.issuedAtTime;
          this.currentUser.tokenExpiresAt = idTokenResult.expirationTime;
          this.currentUser.claims = idTokenResult.claims;
          this.currentUser.lastActivity = Date.now();
          
          // Update session storage
          this.sessionManager.setSession(this.currentUser);
          
          console.log('🔄 Token refreshed successfully');
        }
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  }

  /**
   * Setup automatic token refresh
   */
  setupTokenRefresh() {
    this.refreshTokenTimer = setInterval(() => {
      if (this.currentUser?.isAuthenticated) {
        this.refreshToken();
        this.sessionManager.extendSession();
      }
    }, TOKEN_REFRESH_INTERVAL);
  }

  /**
   * Set admin claims for user (admin only)
   */
  async setAdminClaims(uid) {
    if (!this.hasPermission('admin:users:write')) {
      throw new Error('Insufficient permissions to set admin claims');
    }
    
    try {
      const setAdminRole = httpsCallable(this.functions, 'setAdminRole');
      const result = await setAdminRole({ uid });
      return result.data.success;
    } catch (error) {
      console.error('Error setting admin claims:', error);
      throw new Error('Failed to set admin privileges');
    }
  }

  /**
   * Remove admin claims from user (admin only)
   */
  async removeAdminClaims(uid) {
    if (!this.hasPermission('admin:users:write')) {
      throw new Error('Insufficient permissions to remove admin claims');
    }
    
    try {
      const removeAdminRole = httpsCallable(this.functions, 'removeAdminRole');
      const result = await removeAdminRole({ uid });
      return result.data.success;
    } catch (error) {
      console.error('Error removing admin claims:', error);
      throw new Error('Failed to remove admin privileges');
    }
  }

  /**
   * Initialize admin user (one-time setup)
   */
  async initializeAdminUser(email) {
    try {
      // Use direct fetch for 2nd Gen Cloud Functions
      const functionUrl = 'https://initializeadminuser-7lnuwmjvea-uc.a.run.app';
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error initializing admin user:', error);
      throw new Error('Failed to initialize admin user');
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(eventType, user, details = {}) {
    try {
      await auditService.logAuthEvent(eventType, user, details);
    } catch (error) {
      console.warn('Failed to log auth event:', error);
      // Don't throw - audit logging shouldn't break auth flow
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.refreshTokenTimer) {
      clearInterval(this.refreshTokenTimer);
    }
    this.authListeners.clear();
  }
}

// Create singleton instance
const unifiedAuthService = new UnifiedAuthService();

export default unifiedAuthService;
export { SecureSessionManager };