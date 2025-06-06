/**
 * Security Utilities for Banking Application
 * Provides additional security measures and checks
 */

/**
 * Check if Content Security Policy is supported and active
 * @returns {boolean} True if CSP is supported
 */
export const isCSPSupported = () => {
  return typeof document.createElement('div').nonce !== 'undefined';
};

/**
 * Generate a secure random nonce for inline scripts
 * @returns {string} Base64 encoded nonce
 */
export const generateNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array));
};

/**
 * Validate that we're running on HTTPS in production
 * @returns {boolean} True if secure context
 */
export const isSecureContext = () => {
  return window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

/**
 * Check for common security headers
 * @returns {Object} Security headers status
 */
export const checkSecurityHeaders = async () => {
  try {
    const response = await fetch(window.location.href, { method: 'HEAD' });
    const headers = {};
    
    // Check for important security headers
    const securityHeaders = [
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security',
      'referrer-policy'
    ];
    
    securityHeaders.forEach(header => {
      headers[header] = response.headers.get(header) !== null;
    });
    
    return headers;
  } catch (error) {
    console.warn('Could not check security headers:', error);
    return {};
  }
};

/**
 * Validate URL to prevent open redirect attacks
 * @param {string} url - URL to validate
 * @param {Array} allowedDomains - List of allowed domains
 * @returns {boolean} True if URL is safe
 */
export const isValidRedirectURL = (url, allowedDomains = []) => {
  try {
    const parsedURL = new URL(url, window.location.origin);
    
    // Only allow same origin by default
    if (allowedDomains.length === 0) {
      return parsedURL.origin === window.location.origin;
    }
    
    // Check against allowed domains
    return allowedDomains.includes(parsedURL.hostname);
  } catch (error) {
    return false;
  }
};

/**
 * Check if browser has modern security features
 * @returns {Object} Browser security feature support
 */
export const checkBrowserSecurity = () => {
  return {
    crypto: typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function',
    webCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle === 'object',
    secureContext: isSecureContext(),
    csp: isCSPSupported(),
    localStorage: typeof Storage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    fetch: typeof fetch === 'function',
    promise: typeof Promise === 'function',
    intl: typeof Intl === 'object'
  };
};

/**
 * Generate a secure session ID
 * @returns {string} Secure session ID
 */
export const generateSecureSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for older browsers
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
};

/**
 * Validate that required environment variables are present
 * @returns {Object} Environment validation results
 */
export const validateEnvironment = () => {
  const required = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing: missing,
    hasDevTools: process.env.NODE_ENV === 'development'
  };
};

/**
 * Check for potential security threats in the current environment
 * @returns {Array} List of potential security issues
 */
export const performSecurityAudit = async () => {
  const issues = [];
  
  // Check HTTPS
  if (!isSecureContext() && window.location.hostname !== 'localhost') {
    issues.push({
      severity: 'high',
      type: 'transport',
      message: 'Application not running over HTTPS'
    });
  }
  
  // Check browser security features
  const browserSecurity = checkBrowserSecurity();
  if (!browserSecurity.crypto) {
    issues.push({
      severity: 'high',
      type: 'browser',
      message: 'Browser lacks cryptographic API support'
    });
  }
  
  if (!browserSecurity.secureContext) {
    issues.push({
      severity: 'medium',
      type: 'browser',
      message: 'Browser reports insecure context'
    });
  }
  
  // Check environment
  const envValidation = validateEnvironment();
  if (!envValidation.valid) {
    issues.push({
      severity: 'high',
      type: 'configuration',
      message: `Missing environment variables: ${envValidation.missing.join(', ')}`
    });
  }
  
  // Check for development tools in production
  if (process.env.NODE_ENV === 'production' && envValidation.hasDevTools) {
    issues.push({
      severity: 'medium',
      type: 'configuration',
      message: 'Development tools detected in production build'
    });
  }
  
  // Check local storage for sensitive data
  try {
    const localStorage = window.localStorage;
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        issues.push({
          severity: 'medium',
          type: 'storage',
          message: `Potentially sensitive data in localStorage: ${key}`
        });
      }
    }
  } catch (error) {
    // LocalStorage not available or accessible
  }
  
  return issues;
};

/**
 * Initialize security monitoring
 */
export const initializeSecurityMonitoring = () => {
  // Monitor for console access attempts
  let devtools = { open: false, orientation: null };
  
  const threshold = 160;
  setInterval(() => {
    if (window.outerHeight - window.innerHeight > threshold || 
        window.outerWidth - window.innerWidth > threshold) {
      if (!devtools.open) {
        devtools.open = true;
        console.warn('Developer tools opened - Security monitoring active');
        
        // Log security event
        if (typeof window.logSecurityEvent === 'function') {
          window.logSecurityEvent('devtools_opened', { timestamp: new Date() });
        }
      }
    } else {
      devtools.open = false;
    }
  }, 500);
  
  // Monitor for suspicious activity
  let rapidClicks = 0;
  document.addEventListener('click', () => {
    rapidClicks++;
    setTimeout(() => rapidClicks--, 1000);
    
    if (rapidClicks > 20) {
      console.warn('Rapid clicking detected - Potential automated activity');
      
      if (typeof window.logSecurityEvent === 'function') {
        window.logSecurityEvent('rapid_clicking', { 
          clickCount: rapidClicks,
          timestamp: new Date() 
        });
      }
    }
  });
  
  // Monitor for paste events that might contain malicious content
  document.addEventListener('paste', (event) => {
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      /on\w+\s*=/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(pastedText))) {
      console.warn('Suspicious content pasted - Security monitoring triggered');
      
      if (typeof window.logSecurityEvent === 'function') {
        window.logSecurityEvent('suspicious_paste', { 
          content: pastedText.substring(0, 100),
          timestamp: new Date() 
        });
      }
    }
  });
};

export default {
  isCSPSupported,
  generateNonce,
  isSecureContext,
  checkSecurityHeaders,
  isValidRedirectURL,
  checkBrowserSecurity,
  generateSecureSessionId,
  validateEnvironment,
  performSecurityAudit,
  initializeSecurityMonitoring
};