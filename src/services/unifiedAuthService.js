/**
 * Unified Authentication Service
 * Consolidates Firebase Auth, Redux state management, and secure session handling
 * Replaces the dual auth system with a single, secure implementation
 */

import { getAuth, onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth';
import { getUserData } from './userService';
import auditService, { AUDIT_EVENTS } from './auditService';
import { secureLog, RateLimiter } from '../utils/security';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Secure session configuration
 */
const SESSION_CONFIG = {
  tokenRefreshInterval: 30 * 60 * 1000, // 30 minutes
  sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  storageKey: 'mcduck_secure_session',
};

/**
 * Unified Authentication Manager
 * Handles all authentication state, session management, and security
 */
class UnifiedAuthService {
  constructor() {
    this.auth = getAuth();
    this.currentUser = null;
    this.authState = null;
    this.listeners = new Set();
    this.sessionTimer = null;
    this.refreshTimer = null;
    this.rateLimiter = new RateLimiter(SESSION_CONFIG.maxLoginAttempts, SESSION_CONFIG.lockoutDuration);
    
    // Initialize secure session storage
    this.initializeSession();
    this.setupAuthListeners();
  }

  /**
   * Initialize secure session management
   */
  initializeSession() {
    // Generate session ID if not exists
    if (!this.getSessionId()) {
      this.generateNewSession();
    }

    // Clear any corrupted storage
    this.cleanupCorruptedStorage();
    
    // Set up automatic session cleanup
    this.setupSessionCleanup();
  }

  /**
   * Generate new secure session
   */
  generateNewSession() {
    const sessionId = this.generateSecureSessionId();
    const sessionData = {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      userAgent: navigator.userAgent,
      fingerprint: this.generateBrowserFingerprint()
    };

    this.setSecureStorage('session', sessionData);
    return sessionId;
  }

  /**
   * Generate cryptographically secure session ID
   */
  generateSecureSessionId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    
    // Fallback for older browsers
    const array = new Uint32Array(4);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('-');
  }

  /**
   * Generate browser fingerprint for session validation
   */
  generateBrowserFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);
    
    return {
      screen: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      canvasFingerprint: canvas.toDataURL().slice(-50) // Last 50 chars
    };
  }

  /**
   * Secure storage operations
   */
  setSecureStorage(key, data) {
    try {
      const encrypted = this.encryptData(data);
      localStorage.setItem(`${SESSION_CONFIG.storageKey}_${key}`, encrypted);
      sessionStorage.setItem(`${SESSION_CONFIG.storageKey}_${key}`, encrypted);
    } catch (error) {
      secureLog('error', 'Failed to set secure storage', { key, error: error.message });
    }
  }

  getSecureStorage(key) {
    try {
      const encrypted = localStorage.getItem(`${SESSION_CONFIG.storageKey}_${key}`) ||
                      sessionStorage.getItem(`${SESSION_CONFIG.storageKey}_${key}`);
      
      if (!encrypted) return null;
      return this.decryptData(encrypted);
    } catch (error) {
      secureLog('error', 'Failed to get secure storage', { key, error: error.message });
      return null;
    }
  }

  /**
   * Simple encryption for session data (not cryptographically secure, but obfuscated)
   */
  encryptData(data) {
    const jsonString = JSON.stringify(data);
    return btoa(encodeURIComponent(jsonString));
  }

  decryptData(encrypted) {
    try {
      const decoded = decodeURIComponent(atob(encrypted));
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Invalid encrypted data');
    }
  }

  /**
   * Setup Firebase auth listeners
   */
  setupAuthListeners() {
    // Auth state change listener
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      await this.handleAuthStateChange(firebaseUser);
    });

    // Token refresh listener
    onIdTokenChanged(this.auth, async (firebaseUser) => {
      if (firebaseUser) {
        await this.handleTokenRefresh(firebaseUser);
      }
    });
  }

  /**
   * Handle Firebase auth state changes
   */
  async handleAuthStateChange(firebaseUser) {
    try {
      if (firebaseUser) {
        // User signed in
        if (!this.rateLimiter.isAllowed(firebaseUser.email)) {
          secureLog('warn', 'Login rate limit exceeded', { email: firebaseUser.email });
          await this.signOut();
          throw new Error('Too many login attempts. Please try again later.');
        }

        const idTokenResult = await firebaseUser.getIdTokenResult();
        // Check if this is a genuine new login or just a page refresh/session restore
        const existingAuth = this.getAuthState();
        const isNewLogin = !existingAuth || 
                         existingAuth.user?.uid !== firebaseUser.uid ||
                         (Date.now() - (existingAuth.lastActivity || 0)) > 60000; // More than 1 minute since last activity

        const userData = await this.loadUserData(firebaseUser);
        
        if (userData) {
          
          const authState = await this.createAuthState(firebaseUser, userData, idTokenResult);
          await this.setAuthState(authState);
          
          // Only update last login and log audit event for genuine new logins
          if (isNewLogin) {
            await this.updateLastLogin(userData, firebaseUser);
            
            // Log successful authentication only for new logins
            await auditService.logAuthEvent(AUDIT_EVENTS.LOGIN_SUCCESS, authState.user, {
              sessionId: this.getSessionId(),
              lastLogin: new Date().toISOString(),
              loginType: existingAuth ? 'session_refresh' : 'new_login'
            });
            
            secureLog('info', 'New login detected', { uid: firebaseUser.uid });
          } else {
            secureLog('info', 'Session restored from page refresh', { uid: firebaseUser.uid });
          }

          // Reset rate limiter on successful login
          this.rateLimiter.reset(firebaseUser.email);
        } else {
          // Handle user data not found - be more lenient on session restore
          if (isNewLogin) {
            secureLog('error', 'User data not found after new authentication', { uid: firebaseUser.uid });
            await this.signOut();
          } else {
            // For session restore, try to use existing auth data if available
            if (existingAuth && existingAuth.user) {
              secureLog('warn', 'User data not found on session restore, using cached data', { uid: firebaseUser.uid });
              // Update timestamp but keep existing user data
              const updatedAuthState = {
                ...existingAuth,
                lastActivity: Date.now(),
                tokenResult: idTokenResult
              };
              await this.setAuthState(updatedAuthState);
            } else {
              secureLog('error', 'User data not found and no cached data available', { uid: firebaseUser.uid });
              await this.signOut();
            }
          }
        }
      } else {
        // User signed out
        await this.clearAuthState();
      }
    } catch (error) {
      secureLog('error', 'Auth state change error', { error: error.message });
      await this.clearAuthState();
      this.notifyListeners({ error: error.message });
    }
  }

  /**
   * Handle token refresh
   */
  async handleTokenRefresh(firebaseUser) {
    try {
      const idTokenResult = await firebaseUser.getIdTokenResult(true);
      const currentAuth = this.getAuthState();
      
      if (currentAuth) {
        const updatedAuth = {
          ...currentAuth,
          token: idTokenResult.token,
          tokenExpiration: new Date(idTokenResult.expirationTime).getTime(),
          lastTokenRefresh: Date.now()
        };
        
        await this.setAuthState(updatedAuth);
        secureLog('info', 'Token refreshed successfully', { uid: firebaseUser.uid });
      }
    } catch (error) {
      secureLog('error', 'Token refresh failed', { error: error.message });
    }
  }

  /**
   * Load user data with error handling
   */
  async loadUserData(firebaseUser) {
    try {
      // Try loading by email first (most common)
      let userData = await getUserData(firebaseUser.email);
      
      // Fallback to UID if email lookup fails
      if (!userData) {
        userData = await getUserData(firebaseUser.uid);
      }

      return userData;
    } catch (error) {
      secureLog('error', 'Failed to load user data', { 
        uid: firebaseUser.uid, 
        email: firebaseUser.email,
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Create auth state object
   */
  async createAuthState(firebaseUser, userData, idTokenResult) {
    return {
      isAuthenticated: true,
      user: {
        uid: userData.user_id || firebaseUser.uid,
        email: userData.email || firebaseUser.email,
        displayName: userData.displayName || firebaseUser.displayName,
        photoURL: userData.photoURL || firebaseUser.photoURL,
        administrator: userData.administrator || false,
        emailVerified: firebaseUser.emailVerified
      },
      isAdmin: userData.administrator || idTokenResult.claims.administrator || false,
      sessionId: this.getSessionId(),
      token: idTokenResult.token,
      tokenExpiration: new Date(idTokenResult.expirationTime).getTime(),
      lastActivity: Date.now(),
      loading: false,
      error: null
    };
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userData, firebaseUser) {
    try {
      const docId = userData.id || userData.user_id || firebaseUser.email;
      const userRef = doc(db, 'accounts', docId);
      
      await setDoc(userRef, {
        lastLogin: new Date(),
        lastIp: 'server-detected', // IP will be detected server-side
        lastSessionToken: this.getSessionId(),
        lastActivity: new Date()
      }, { merge: true });
    } catch (error) {
      secureLog('error', 'Failed to update last login', { error: error.message });
    }
  }

  /**
   * Set auth state and persist securely
   */
  async setAuthState(authState) {
    this.authState = authState;
    this.setSecureStorage('auth', authState);
    this.setupSessionTimeout();
    this.setupTokenRefresh();
    this.notifyListeners(authState);
  }

  /**
   * Get current auth state
   */
  getAuthState() {
    if (this.authState) return this.authState;
    
    // Try to restore from secure storage
    const stored = this.getSecureStorage('auth');
    if (stored && this.validateStoredSession(stored)) {
      this.authState = stored;
      return stored;
    }
    
    return null;
  }

  /**
   * Validate stored session
   */
  validateStoredSession(authState) {
    const session = this.getSecureStorage('session');
    if (!session) return false;

    // Check session timeout
    const now = Date.now();
    if (now - session.lastActivity > SESSION_CONFIG.sessionTimeout) {
      secureLog('info', 'Session expired due to inactivity');
      return false;
    }

    // Check token expiration
    if (authState.tokenExpiration && now >= authState.tokenExpiration) {
      secureLog('info', 'Token expired');
      return false;
    }

    // Validate browser fingerprint
    const currentFingerprint = this.generateBrowserFingerprint();
    if (JSON.stringify(session.fingerprint) !== JSON.stringify(currentFingerprint)) {
      secureLog('warn', 'Browser fingerprint mismatch - possible session hijacking attempt');
      return false;
    }

    return true;
  }

  /**
   * Clear auth state
   */
  async clearAuthState() {
    this.authState = null;
    this.clearSecureStorage();
    this.clearTimers();
    this.notifyListeners({ isAuthenticated: false, loading: false });
  }

  /**
   * Sign out user
   */
  async signOut() {
    try {
      const currentAuth = this.getAuthState();
      
      if (currentAuth?.user) {
        // Log logout event
        await auditService.logAuthEvent(AUDIT_EVENTS.LOGOUT, currentAuth.user, {
          sessionId: this.getSessionId(),
          sessionDuration: Date.now() - (currentAuth.lastActivity || Date.now())
        });
      }

      await signOut(this.auth);
      await this.clearAuthState();
      this.generateNewSession(); // Generate new session for security
      
      secureLog('info', 'User signed out successfully');
    } catch (error) {
      secureLog('error', 'Sign out error', { error: error.message });
      await this.clearAuthState(); // Clear state even if Firebase signOut fails
    }
  }

  /**
   * Session management
   */
  getSessionId() {
    const session = this.getSecureStorage('session');
    return session?.id || null;
  }

  updateActivity() {
    const session = this.getSecureStorage('session');
    if (session) {
      session.lastActivity = Date.now();
      this.setSecureStorage('session', session);
    }

    const authState = this.getAuthState();
    if (authState) {
      authState.lastActivity = Date.now();
      this.setSecureStorage('auth', authState);
    }
  }

  /**
   * Setup automatic session timeout
   */
  setupSessionTimeout() {
    this.clearTimers();
    
    this.sessionTimer = setTimeout(() => {
      secureLog('info', 'Session timeout reached');
      this.signOut();
    }, SESSION_CONFIG.sessionTimeout);
  }

  /**
   * Setup automatic token refresh
   */
  setupTokenRefresh() {
    this.refreshTimer = setTimeout(async () => {
      if (this.auth.currentUser) {
        try {
          await this.auth.currentUser.getIdToken(true);
        } catch (error) {
          secureLog('error', 'Automatic token refresh failed', { error: error.message });
        }
      }
    }, SESSION_CONFIG.tokenRefreshInterval);
  }

  /**
   * Clear all timers
   */
  clearTimers() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Storage cleanup
   */
  clearSecureStorage() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(SESSION_CONFIG.storageKey)) {
          localStorage.removeItem(key);
        }
      });
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(SESSION_CONFIG.storageKey)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      secureLog('error', 'Failed to clear secure storage', { error: error.message });
    }
  }

  cleanupCorruptedStorage() {
    try {
      // Clear old auth data that might be corrupted
      ['mcduck_auth_state', 'sessionToken'].forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    } catch (error) {
      secureLog('error', 'Failed to cleanup corrupted storage', { error: error.message });
    }
  }

  setupSessionCleanup() {
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      if (this.authState?.user) {
        // Update last activity
        this.updateActivity();
      }
    });

    // Update activity on user interaction
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
      document.addEventListener(event, () => {
        this.updateActivity();
      }, { passive: true, once: false });
    });
  }

  /**
   * Listener management
   */
  addListener(callback) {
    this.listeners.add(callback);
    
    // Immediately call with current state
    const currentState = this.getAuthState() || { isAuthenticated: false, loading: false };
    callback(currentState);
    
    return () => this.listeners.delete(callback);
  }

  notifyListeners(authState) {
    this.listeners.forEach(callback => {
      try {
        callback(authState);
      } catch (error) {
        secureLog('error', 'Auth listener error', { error: error.message });
      }
    });
  }

  /**
   * Permission helpers
   */
  hasPermission(permission) {
    const authState = this.getAuthState();
    if (!authState?.isAuthenticated) return false;
    
    const permissions = this.getUserPermissions();
    return permissions.includes(permission);
  }

  canAccessResource(resourceUserId) {
    const authState = this.getAuthState();
    if (!authState?.isAuthenticated) return false;
    if (authState.isAdmin) return true;
    return authState.user?.uid === resourceUserId;
  }

  getUserPermissions() {
    const authState = this.getAuthState();
    if (!authState?.user) return [];
    
    const permissions = ['user:read', 'user:update'];
    
    if (authState.isAdmin) {
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
  }
}

// Create singleton instance
const unifiedAuthService = new UnifiedAuthService();

export default unifiedAuthService;