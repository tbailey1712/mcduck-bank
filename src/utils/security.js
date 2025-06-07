/**
 * Security utilities for XSS protection, input sanitization, and secure operations
 * Provides comprehensive security measures for the banking application
 */

import DOMPurify from 'dompurify';
import { sanitizeInput, sanitizeObject } from './validation';

/**
 * Security configuration
 */
const SECURITY_CONFIG = {
  // DOMPurify configuration for different contexts
  STRICT_HTML: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  },
  
  SAFE_HTML: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  },
  
  // Maximum input lengths
  MAX_LENGTHS: {
    displayName: 100,
    description: 500,
    comment: 200,
    reason: 300,
    generalText: 1000
  },
  
  // Sensitive fields that should never contain HTML
  SENSITIVE_FIELDS: [
    'password',
    'token',
    'sessionId',
    'amount',
    'balance',
    'accountNumber',
    'routingNumber',
    'ssn',
    'taxId'
  ]
};

/**
 * Comprehensive input sanitization for user inputs
 * @param {string} input - Input to sanitize
 * @param {string} context - Context of the input (text, html, numeric, etc.)
 * @returns {string} - Sanitized input
 */
export const secureSanitize = (input, context = 'text') => {
  if (typeof input !== 'string') return '';
  
  switch (context) {
    case 'html':
      return DOMPurify.sanitize(input, SECURITY_CONFIG.SAFE_HTML);
    
    case 'strict':
      return DOMPurify.sanitize(input, SECURITY_CONFIG.STRICT_HTML);
    
    case 'numeric':
      // Only allow numbers, decimal points, and common currency symbols
      return input.replace(/[^\d.\-$,]/g, '').trim();
    
    case 'email':
      // Basic email sanitization - remove dangerous characters
      return input.replace(/[<>'"]/g, '').trim().toLowerCase();
    
    case 'filename':
      // Safe filename characters only
      return input.replace(/[^a-zA-Z0-9._-]/g, '').trim();
    
    case 'url':
      // Basic URL sanitization
      try {
        const url = new URL(input);
        return url.toString();
      } catch {
        return '';
      }
    
    default: // 'text'
      return sanitizeInput(input, { stripTags: true });
  }
};

/**
 * Sanitize form data before processing
 * @param {Object} formData - Form data to sanitize
 * @param {Object} fieldConfig - Configuration for each field
 * @returns {Object} - Sanitized form data
 */
export const sanitizeFormData = (formData, fieldConfig = {}) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(formData)) {
    const config = fieldConfig[key] || {};
    const context = config.context || 'text';
    const maxLength = config.maxLength || SECURITY_CONFIG.MAX_LENGTHS.generalText;
    
    if (typeof value === 'string') {
      // Sanitize and enforce length limits
      let sanitizedValue = secureSanitize(value, context);
      
      if (sanitizedValue.length > maxLength) {
        sanitizedValue = sanitizedValue.substring(0, maxLength);
      }
      
      sanitized[key] = sanitizedValue;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, SECURITY_CONFIG.SENSITIVE_FIELDS);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Validate and sanitize transaction data
 * @param {Object} transactionData - Transaction data to process
 * @returns {Object} - Sanitized transaction data
 */
export const sanitizeTransactionData = (transactionData) => {
  const fieldConfig = {
    description: { context: 'text', maxLength: SECURITY_CONFIG.MAX_LENGTHS.description },
    comment: { context: 'text', maxLength: SECURITY_CONFIG.MAX_LENGTHS.comment },
    reason: { context: 'text', maxLength: SECURITY_CONFIG.MAX_LENGTHS.reason },
    amount: { context: 'numeric', maxLength: 20 },
    type: { context: 'strict', maxLength: 50 },
    transaction_type: { context: 'strict', maxLength: 50 }
  };
  
  return sanitizeFormData(transactionData, fieldConfig);
};

/**
 * Validate and sanitize profile data
 * @param {Object} profileData - Profile data to process
 * @returns {Object} - Sanitized profile data
 */
export const sanitizeProfileData = (profileData) => {
  const fieldConfig = {
    displayName: { context: 'text', maxLength: SECURITY_CONFIG.MAX_LENGTHS.displayName },
    mobile: { context: 'numeric', maxLength: 20 },
    email: { context: 'email', maxLength: 255 }
  };
  
  return sanitizeFormData(profileData, fieldConfig);
};

/**
 * Detect potentially dangerous content
 * @param {string} input - Input to analyze
 * @returns {Object} - Security analysis result
 */
export const analyzeSecurityRisk = (input) => {
  if (typeof input !== 'string') {
    return { safe: true, risk: 'none', issues: [] };
  }
  
  const issues = [];
  let riskLevel = 'none';
  
  // Check for script tags
  if (/<script/i.test(input)) {
    issues.push('Contains script tags');
    riskLevel = 'high';
  }
  
  // Check for event handlers
  if (/on\w+\s*=/i.test(input)) {
    issues.push('Contains event handlers');
    riskLevel = 'high';
  }
  
  // Check for javascript: URLs
  if (/javascript:/i.test(input)) {
    issues.push('Contains javascript: URLs');
    riskLevel = 'high';
  }
  
  // Check for common XSS vectors
  if (/<iframe|<object|<embed|<link/i.test(input)) {
    issues.push('Contains potentially dangerous HTML elements');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }
  
  // Check for SQL injection patterns (basic)
  if (/(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b)/i.test(input)) {
    issues.push('Contains SQL-like keywords');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }
  
  // Check for excessive length
  if (input.length > 10000) {
    issues.push('Input exceeds safe length limits');
    riskLevel = riskLevel === 'high' ? 'high' : 'low';
  }
  
  return {
    safe: issues.length === 0,
    risk: riskLevel,
    issues
  };
};

/**
 * Create a Content Security Policy string
 * @returns {string} - CSP header value
 */
export const generateCSP = () => {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebase.googleapis.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
  
  return directives.join('; ');
};

/**
 * Secure logging function that removes sensitive information
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
export const secureLog = (level, message, data = {}) => {
  // Remove sensitive information from logs
  const sanitizedData = sanitizeObject(data, SECURITY_CONFIG.SENSITIVE_FIELDS);
  
  // Remove any values that look like tokens or passwords
  const cleanedData = JSON.parse(JSON.stringify(sanitizedData, (key, value) => {
    if (typeof value === 'string') {
      // Mask potential tokens/passwords
      if (value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value)) {
        return '[MASKED_TOKEN]';
      }
      // Mask potential emails in non-email fields
      if (key !== 'email' && /\S+@\S+\.\S+/.test(value)) {
        return '[MASKED_EMAIL]';
      }
    }
    return value;
  }));
  
  console[level](`[SECURE] ${message}`, cleanedData);
};

/**
 * Rate limiting helper for sensitive operations
 */
export class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 300000) { // 5 attempts per 5 minutes
    this.attempts = new Map();
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }
  
  isAllowed(identifier) {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = userAttempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Record this attempt
    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);
    
    return true;
  }
  
  reset(identifier) {
    this.attempts.delete(identifier);
  }
}

export default {
  secureSanitize,
  sanitizeFormData,
  sanitizeTransactionData,
  sanitizeProfileData,
  analyzeSecurityRisk,
  generateCSP,
  secureLog,
  RateLimiter,
  SECURITY_CONFIG
};