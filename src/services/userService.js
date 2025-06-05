/**
 * @deprecated This service is deprecated. Use apiService.js instead.
 * This file is kept for backward compatibility during migration.
 */

import apiService from './apiService';

console.warn('userService.js is deprecated. Please migrate to apiService.js');

// Wrapper functions for backward compatibility
export const getUserData = async (identifier, authUser = null) => {
  const result = await apiService.getUserData(identifier, authUser);
  return result.success ? result.data : null;
};

export const subscribeToUserData = (userId, onData, authUser = null) => {
  return apiService.subscribeToUserData(userId, (result) => {
    if (result.success) {
      onData(result.data);
    } else {
      console.error('User data subscription error:', result.error);
      onData(null);
    }
  }, authUser);
};

export const subscribeToTransactions = (userId, onData, authUser = null) => {
  return apiService.subscribeToTransactions(userId, (result) => {
    if (result.success) {
      onData(result.data);
    } else {
      console.error('Transaction subscription error:', result.error);
      onData([]);
    }
  }, { authUser });
};
