/**
 * Validation and sanitization utilities
 * Provides reusable validation functions and input sanitization with XSS protection
 */

import DOMPurify from 'dompurify';

// Regular expressions for validation
const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  positiveNumber: /^\d*\.?\d+$/,
  wholeNumber: /^\d+$/,
  alphanumeric: /^[a-zA-Z0-9\s]+$/,
  safeText: /^[a-zA-Z0-9\s.,!?-]+$/, // Safe characters for descriptions
};

// Common validation messages
const VALIDATION_MESSAGES = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  positiveNumber: 'Please enter a positive number',
  wholeNumber: 'Please enter a whole number',
  minLength: (min) => `Must be at least ${min} characters`,
  maxLength: (max) => `Must be no more than ${max} characters`,
  minValue: (min) => `Must be at least ${min}`,
  maxValue: (max) => `Must be no more than ${max}`,
  invalidChars: 'Contains invalid characters',
  tooLarge: 'Amount is too large',
  tooSmall: 'Amount is too small',
};

/**
 * Sanitize input to prevent XSS attacks using DOMPurify
 * @param {string} input - The input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized input
 */
export const sanitizeInput = (input, options = {}) => {
  if (typeof input !== 'string') return '';
  
  const {
    allowHtml = false,
    stripTags = true,
    preserveWhitespace = false
  } = options;
  
  let sanitized = input;
  
  // Trim whitespace unless preserving
  if (!preserveWhitespace) {
    sanitized = sanitized.trim();
  }
  
  if (allowHtml) {
    // Allow safe HTML but remove dangerous elements/attributes
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  } else if (stripTags) {
    // Strip all HTML tags and get text content only
    sanitized = DOMPurify.sanitize(sanitized, { 
      ALLOWED_TAGS: [], 
      KEEP_CONTENT: true 
    });
  } else {
    // HTML encode dangerous characters
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      USE_PROFILES: { html: true }
    });
  }
  
  return sanitized;
};

/**
 * Sanitize HTML content for safe rendering
 * @param {string} html - The HTML content to sanitize
 * @returns {string} - Safe HTML content
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== 'string') return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
};

/**
 * Deep sanitize an object's string properties
 * @param {Object} obj - Object to sanitize
 * @param {Array} excludeKeys - Keys to exclude from sanitization
 * @returns {Object} - Sanitized object
 */
export const sanitizeObject = (obj, excludeKeys = []) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (excludeKeys.includes(key)) {
      sanitized[key] = value;
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, excludeKeys);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Sanitize numeric input
 * @param {string} input - The numeric input to sanitize
 * @returns {string} - Sanitized numeric input
 */
export const sanitizeNumericInput = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove any non-numeric characters except decimal point
  return input.replace(/[^\d.]/g, '');
};

/**
 * Validate required field
 * @param {any} value - The value to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateRequired = (value) => {
  if (value === null || value === undefined || value === '') {
    return VALIDATION_MESSAGES.required;
  }
  return null;
};

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateEmail = (email) => {
  if (!email) return null; // Allow empty if not required
  
  if (!VALIDATION_PATTERNS.email.test(email)) {
    return VALIDATION_MESSAGES.email;
  }
  return null;
};

/**
 * Validate positive number
 * @param {string|number} value - The value to validate
 * @param {Object} options - Validation options
 * @returns {string|null} - Error message or null if valid
 */
export const validatePositiveNumber = (value, options = {}) => {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = options;
  
  if (!value && !required) return null;
  if (!value && required) return VALIDATION_MESSAGES.required;
  
  const numValue = parseFloat(value);
  
  if (isNaN(numValue)) {
    return VALIDATION_MESSAGES.positiveNumber;
  }
  
  if (numValue < 0) {
    return VALIDATION_MESSAGES.positiveNumber;
  }
  
  if (numValue < min) {
    return VALIDATION_MESSAGES.minValue(min);
  }
  
  if (numValue > max) {
    return VALIDATION_MESSAGES.maxValue(max);
  }
  
  return null;
};

/**
 * Validate withdrawal amount specifically
 * @param {string|number} amount - The amount to validate
 * @param {number} maxBalance - Maximum allowed amount (user's balance)
 * @returns {string|null} - Error message or null if valid
 */
export const validateWithdrawalAmount = (amount, maxBalance = Infinity) => {
  const basicValidation = validatePositiveNumber(amount, { 
    min: 0.01, 
    max: 1000000, 
    required: true 
  });
  
  if (basicValidation) return basicValidation;
  
  const numAmount = parseFloat(amount);
  
  // Check for reasonable minimum withdrawal
  if (numAmount < 0.01) {
    return 'Minimum withdrawal amount is $0.01';
  }
  
  // Check for reasonable maximum withdrawal
  if (numAmount > 1000000) {
    return 'Maximum withdrawal amount is $1,000,000';
  }
  
  // Check against user's balance if provided
  if (maxBalance !== Infinity && numAmount > maxBalance) {
    return 'Insufficient funds for this withdrawal';
  }
  
  return null;
};

/**
 * Validate text length
 * @param {string} text - The text to validate
 * @param {Object} options - Validation options
 * @returns {string|null} - Error message or null if valid
 */
export const validateTextLength = (text, options = {}) => {
  const { min = 0, max = 500, required = false } = options;
  
  if (!text && !required) return null;
  if (!text && required) return VALIDATION_MESSAGES.required;
  
  if (text.length < min) {
    return VALIDATION_MESSAGES.minLength(min);
  }
  
  if (text.length > max) {
    return VALIDATION_MESSAGES.maxLength(max);
  }
  
  return null;
};

/**
 * Validate safe text (description fields)
 * @param {string} text - The text to validate
 * @param {Object} options - Validation options
 * @returns {string|null} - Error message or null if valid
 */
export const validateSafeText = (text, options = {}) => {
  const lengthValidation = validateTextLength(text, options);
  if (lengthValidation) return lengthValidation;
  
  if (text && !VALIDATION_PATTERNS.safeText.test(text)) {
    return VALIDATION_MESSAGES.invalidChars;
  }
  
  return null;
};

/**
 * Validate transaction description
 * @param {string} description - The description to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateTransactionDescription = (description) => {
  return validateSafeText(description, {
    min: 3,
    max: 200,
    required: true
  });
};

/**
 * Comprehensive form validator
 * @param {Object} values - Form values to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} - Validation errors object
 */
export const validateForm = (values, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const value = values[field];
    const fieldRules = rules[field];
    
    for (const rule of fieldRules) {
      const error = rule(value, values);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  });
  
  return errors;
};

/**
 * Format currency amount for display
 * @param {string|number} amount - The amount to format
 * @returns {number|null} - Parsed amount or null if invalid
 */
export const parseAmount = (amount) => {
  const sanitized = sanitizeNumericInput(String(amount));
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? null : parsed;
};

export default {
  sanitizeInput,
  sanitizeHtml,
  sanitizeObject,
  sanitizeNumericInput,
  validateRequired,
  validateEmail,
  validatePositiveNumber,
  validateWithdrawalAmount,
  validateTextLength,
  validateSafeText,
  validateTransactionDescription,
  validateForm,
  parseAmount,
  VALIDATION_MESSAGES,
};