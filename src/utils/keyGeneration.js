/**
 * Utility functions for generating stable React keys
 * Prevents render issues and improves performance
 */

/**
 * Generate a stable key for React list items
 * @param {Object} item - The item to generate a key for
 * @param {number} index - Fallback index if no unique identifier
 * @param {string} prefix - Optional prefix for the key
 * @returns {string} Stable key for React
 */
export const generateStableKey = (item, index, prefix = '') => {
  // Try to use unique identifier first
  if (item?.id) {
    return `${prefix}${item.id}`;
  }
  
  // Try timestamp + index combination for transactions
  if (item?.timestamp) {
    const timestamp = item.timestamp instanceof Date 
      ? item.timestamp.getTime() 
      : new Date(item.timestamp).getTime();
    return `${prefix}${timestamp}-${index}`;
  }
  
  // For user objects, try using uid or email
  if (item?.uid) {
    return `${prefix}${item.uid}`;
  }
  
  if (item?.email) {
    return `${prefix}${item.email.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }
  
  // Use a combination of available properties
  if (item?.user_id && item?.amount) {
    return `${prefix}${item.user_id}-${item.amount}-${index}`;
  }
  
  // Fallback to index (not ideal but better than random)
  console.warn(`Using fallback key for item at index ${index}. Consider adding unique identifier.`, item);
  return `${prefix}fallback-${index}`;
};

/**
 * Generate a stable key for transaction items
 * @param {Object} transaction - Transaction object
 * @param {number} index - Array index
 * @returns {string} Stable key for transaction
 */
export const generateTransactionKey = (transaction, index) => {
  if (transaction?.id) {
    return `transaction-${transaction.id}`;
  }
  
  // Combine multiple properties for uniqueness
  const parts = [
    transaction?.user_id || 'unknown',
    transaction?.amount || '0',
    transaction?.transaction_type || 'unknown',
    transaction?.timestamp ? new Date(transaction.timestamp).getTime() : Date.now(),
    index
  ];
  
  return `transaction-${parts.join('-')}`;
};

/**
 * Generate a stable key for user items
 * @param {Object} user - User object
 * @param {number} index - Array index
 * @returns {string} Stable key for user
 */
export const generateUserKey = (user, index) => {
  if (user?.uid) {
    return `user-${user.uid}`;
  }
  
  if (user?.id) {
    return `user-${user.id}`;
  }
  
  if (user?.email) {
    return `user-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }
  
  return `user-fallback-${index}`;
};

/**
 * Generate a key for route/navigation items
 * @param {Object} route - Route object
 * @param {number} index - Array index
 * @returns {string} Stable key for route
 */
export const generateRouteKey = (route, index) => {
  if (route?.path) {
    return `route-${route.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }
  
  if (route?.name) {
    return `route-${route.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }
  
  return `route-${index}`;
};

/**
 * Generate a compound key from multiple properties
 * Useful for items that need uniqueness across multiple dimensions
 * @param {Object} item - Object with properties
 * @param {string[]} keyFields - Array of field names to use for key
 * @param {string} separator - Separator between key parts
 * @returns {string} Compound key
 */
export const generateCompoundKey = (item, keyFields, separator = '-') => {
  const keyParts = keyFields
    .map(field => {
      const value = item?.[field];
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'object') {
        if (value instanceof Date) return value.getTime();
        return JSON.stringify(value);
      }
      return String(value).replace(/[^a-zA-Z0-9]/g, '_');
    })
    .filter(part => part !== 'null');
  
  return keyParts.length > 0 ? keyParts.join(separator) : `compound-${Date.now()}`;
};

/**
 * Create a key generator function with consistent prefix
 * @param {string} prefix - Prefix for all keys
 * @returns {Function} Key generator function
 */
export const createKeyGenerator = (prefix) => {
  return (item, index) => generateStableKey(item, index, `${prefix}-`);
};

/**
 * Validate that an array of items has unique keys
 * Useful for development/debugging
 * @param {Array} items - Array of items
 * @param {Function} keyGenerator - Function to generate keys
 * @returns {Object} Validation result
 */
export const validateUniqueKeys = (items, keyGenerator = generateStableKey) => {
  const keys = items.map((item, index) => keyGenerator(item, index));
  const uniqueKeys = new Set(keys);
  
  const hasDuplicates = keys.length !== uniqueKeys.size;
  const duplicates = [];
  
  if (hasDuplicates) {
    const keyCount = {};
    keys.forEach(key => {
      keyCount[key] = (keyCount[key] || 0) + 1;
    });
    
    Object.entries(keyCount).forEach(([key, count]) => {
      if (count > 1) {
        duplicates.push({ key, count });
      }
    });
  }
  
  return {
    isValid: !hasDuplicates,
    totalKeys: keys.length,
    uniqueKeys: uniqueKeys.size,
    duplicates,
    keys: process.env.NODE_ENV === 'development' ? keys : undefined
  };
};

// Default export with all utilities
export default {
  generateStableKey,
  generateTransactionKey,
  generateUserKey,
  generateRouteKey,
  generateCompoundKey,
  createKeyGenerator,
  validateUniqueKeys
};