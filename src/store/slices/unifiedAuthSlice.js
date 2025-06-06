/**
 * Unified Auth Redux Slice
 * Simplified Redux slice that syncs with the unified auth service
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import unifiedAuthService from '../../services/unifiedAuthService';

const initialState = {
  isAuthenticated: false,
  user: null,
  isAdmin: false,
  uid: null,
  loading: true,
  error: null,
  permissions: [],
  claims: {},
  sessionId: null,
  lastActivity: null,
  initialized: false
};

/**
 * Initialize authentication
 */
export const initializeAuth = createAsyncThunk(
  'unifiedAuth/initialize',
  async (_, { dispatch }) => {
    return new Promise((resolve) => {
      // Set up listener for auth state changes
      const unsubscribe = unifiedAuthService.addAuthListener((authState) => {
        if (authState?.error) {
          dispatch(setError(authState.error));
          dispatch(setLoading(false));
          resolve({ initialized: true });
        } else if (authState) {
          dispatch(setAuthState(authState));
          resolve(authState);
        } else {
          // Only clear auth after Firebase has definitely determined no user
          dispatch(clearAuth());
          dispatch(setLoading(false));
          resolve({ initialized: true });
        }
      });

      // Store unsubscribe function for cleanup
      window.authUnsubscribe = unsubscribe;
      
      // Get current auth state if available
      const currentAuth = unifiedAuthService.getCurrentAuth();
      if (currentAuth?.isAuthenticated) {
        dispatch(setAuthState(currentAuth));
        resolve(currentAuth);
      }
      
      // If no immediate auth state, wait for listener to fire
      // This gives Firebase time to restore auth on page refresh
    });
  }
);

/**
 * Logout user
 */
export const logoutUser = createAsyncThunk(
  'unifiedAuth/logout',
  async () => {
    await unifiedAuthService.signOut();
    return null;
  }
);

/**
 * Refresh authentication token
 */
export const refreshToken = createAsyncThunk(
  'unifiedAuth/refreshToken',
  async () => {
    await unifiedAuthService.refreshToken();
    return unifiedAuthService.getCurrentAuth();
  }
);

/**
 * Set admin claims for user
 */
export const setAdminClaims = createAsyncThunk(
  'unifiedAuth/setAdminClaims',
  async (uid, { rejectWithValue }) => {
    try {
      const success = await unifiedAuthService.setAdminClaims(uid);
      return { uid, success };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Remove admin claims from user
 */
export const removeAdminClaims = createAsyncThunk(
  'unifiedAuth/removeAdminClaims',
  async (uid, { rejectWithValue }) => {
    try {
      const success = await unifiedAuthService.removeAdminClaims(uid);
      return { uid, success };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const unifiedAuthSlice = createSlice({
  name: 'unifiedAuth',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    setAuthState: (state, action) => {
      const authState = action.payload;
      
      state.isAuthenticated = authState.isAuthenticated || false;
      state.user = authState.user || null;
      state.isAdmin = authState.isAdmin || false;
      state.uid = authState.user?.uid || null;
      state.permissions = authState.permissions || [];
      state.claims = authState.claims || {};
      state.sessionId = authState.sessionId || null;
      state.lastActivity = authState.lastActivity || null;
      state.loading = false;
      state.error = null;
      state.initialized = true;
    },
    
    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.isAdmin = false;
      state.uid = null;
      state.permissions = [];
      state.claims = {};
      state.sessionId = null;
      state.lastActivity = null;
      state.error = null;
      state.initialized = true;
    },
    
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    }
  },
  
  extraReducers: (builder) => {
    builder
      // Initialize auth
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        if (action.payload?.isAuthenticated) {
          unifiedAuthSlice.caseReducers.setAuthState(state, action);
        } else {
          state.loading = false;
          state.initialized = true;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.initialized = true;
      })
      
      // Logout user
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        unifiedAuthSlice.caseReducers.clearAuth(state);
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // Refresh token
      .addCase(refreshToken.fulfilled, (state, action) => {
        if (action.payload?.isAuthenticated) {
          unifiedAuthSlice.caseReducers.setAuthState(state, action);
        }
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.error = action.error.message;
      })
      
      // Admin claims management
      .addCase(setAdminClaims.fulfilled, (state) => {
        // Success is handled by auth state listener
        state.error = null;
      })
      .addCase(setAdminClaims.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      .addCase(removeAdminClaims.fulfilled, (state) => {
        // Success is handled by auth state listener
        state.error = null;
      })
      .addCase(removeAdminClaims.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const {
  setLoading,
  setError,
  clearError,
  setAuthState,
  clearAuth,
  updateLastActivity
} = unifiedAuthSlice.actions;

export default unifiedAuthSlice.reducer;