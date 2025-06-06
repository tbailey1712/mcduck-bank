/**
 * Admin Service - Handles admin-specific operations and custom claims
 */

import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebaseApp from '../config/firebaseConfig';

const auth = getAuth();
const functions = getFunctions(firebaseApp, 'us-central1');

/**
 * Set admin custom claims for a user
 * This function should be called from a Firebase Cloud Function for security
 * @param {string} uid - User ID to grant admin privileges
 * @returns {Promise<boolean>} Success status
 */
export const setAdminClaims = async (uid) => {
  try {
    const setAdminRole = httpsCallable(functions, 'setAdminRole');
    const result = await setAdminRole({ uid });
    return result.data.success;
  } catch (error) {
    console.error('Error setting admin claims:', error);
    throw new Error('Failed to set admin privileges');
  }
};

/**
 * Remove admin custom claims from a user
 * @param {string} uid - User ID to revoke admin privileges
 * @returns {Promise<boolean>} Success status
 */
export const removeAdminClaims = async (uid) => {
  try {
    const removeAdminRole = httpsCallable(functions, 'removeAdminRole');
    const result = await removeAdminRole({ uid });
    return result.data.success;
  } catch (error) {
    console.error('Error removing admin claims:', error);
    throw new Error('Failed to remove admin privileges');
  }
};

/**
 * Force token refresh to get updated custom claims
 * @returns {Promise<void>}
 */
export const refreshUserToken = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await user.getIdToken(true); // Force refresh
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw new Error('Failed to refresh authentication token');
  }
};

/**
 * Get current user's custom claims
 * @returns {Promise<Object>} User's custom claims
 */
export const getUserClaims = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    const idTokenResult = await user.getIdTokenResult();
    return idTokenResult.claims;
  } catch (error) {
    console.error('Error getting user claims:', error);
    throw new Error('Failed to get user claims');
  }
};

/**
 * Check if current user has admin privileges
 * @returns {Promise<boolean>} True if user is admin
 */
export const isUserAdmin = async () => {
  try {
    const claims = await getUserClaims();
    return claims.administrator === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Initialize admin user (for initial setup only)
 * This should be called once during app setup to grant initial admin access
 * @param {string} email - Email of the initial admin user
 * @returns {Promise<boolean>} Success status
 */
export const initializeAdminUser = async (email) => {
  try {
    const initAdmin = httpsCallable(functions, 'initializeAdminUser');
    const result = await initAdmin({ email });
    return result.data.success;
  } catch (error) {
    console.error('Error initializing admin user:', error);
    throw new Error('Failed to initialize admin user');
  }
};

export default {
  setAdminClaims,
  removeAdminClaims,
  refreshUserToken,
  getUserClaims,
  isUserAdmin,
  initializeAdminUser
};