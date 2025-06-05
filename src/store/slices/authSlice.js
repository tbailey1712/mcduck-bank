import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getUserData } from '../../services/userService';
import auditService, { AUDIT_EVENTS } from '../../services/auditService';
import { v4 as uuidv4 } from 'uuid';

const initialState = {
  isAuthenticated: false,
  user: null,
  isAdmin: false,
  uid: null,
  loading: true,
  error: null,
  sessionToken: null,
};

// Enhanced persistence for PWAs
// Clear corrupted IndexedDB data
const clearCorruptedIndexedDB = () => {
  if ('indexedDB' in window) {
    const deleteRequest = indexedDB.deleteDatabase('McDuckBankAuth');
    deleteRequest.onsuccess = () => console.log('Cleared corrupted IndexedDB');
    deleteRequest.onerror = () => console.warn('Failed to clear IndexedDB');
  }
};

const persistAuthState = (authData) => {
  try {
    // Multiple storage strategies for PWA persistence
    localStorage.setItem('mcduck_auth_state', JSON.stringify(authData));
    sessionStorage.setItem('mcduck_auth_state', JSON.stringify(authData));
    
    // IndexedDB for more persistent storage
    if ('indexedDB' in window) {
      const request = indexedDB.open('McDuckBankAuth', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('authStore')) {
          db.createObjectStore('authStore');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        try {
          // Check if object store exists before creating transaction
          if (db.objectStoreNames.contains('authStore')) {
            const transaction = db.transaction(['authStore'], 'readwrite');
            const store = transaction.objectStore('authStore');
            store.put(authData, 'currentAuth');
          } else {
            console.warn('IndexedDB object store "authStore" not found');
          }
        } catch (error) {
          console.warn('IndexedDB transaction failed:', error);
          // If transaction fails due to corrupted database, clear it
          if (error.name === 'NotFoundError') {
            clearCorruptedIndexedDB();
          }
        }
      };
      request.onerror = () => {
        console.warn('IndexedDB open request failed');
      };
    }
  } catch (error) {
    console.warn('Failed to persist auth state:', error);
  }
};

const getPersistedAuthState = async () => {
  try {
    // Try localStorage first
    const localState = localStorage.getItem('mcduck_auth_state');
    if (localState) return JSON.parse(localState);
    
    // Try sessionStorage
    const sessionState = sessionStorage.getItem('mcduck_auth_state');
    if (sessionState) return JSON.parse(sessionState);
    
    // Try IndexedDB
    if ('indexedDB' in window) {
      return new Promise((resolve) => {
        const request = indexedDB.open('McDuckBankAuth', 1);
        request.onsuccess = () => {
          const db = request.result;
          try {
            if (db.objectStoreNames.contains('authStore')) {
              const transaction = db.transaction(['authStore'], 'readonly');
              const store = transaction.objectStore('authStore');
              const getRequest = store.get('currentAuth');
              getRequest.onsuccess = () => resolve(getRequest.result);
              getRequest.onerror = () => resolve(null);
            } else {
              resolve(null);
            }
          } catch (error) {
            console.warn('IndexedDB read transaction failed:', error);
            // If transaction fails due to corrupted database, clear it
            if (error.name === 'NotFoundError') {
              clearCorruptedIndexedDB();
            }
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    }
  } catch (error) {
    console.warn('Failed to get persisted auth state:', error);
  }
  return null;
};

// Async thunk for initializing auth
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch }) => {
    const auth = getAuth();
    const sessionToken = localStorage.getItem('sessionToken') || uuidv4();
    localStorage.setItem('sessionToken', sessionToken);
    
    // Try to restore persisted auth state for PWAs
    const persistedAuth = await getPersistedAuthState();
    if (persistedAuth) {
      console.log('🔄 Restored persisted auth state for PWA');
      // Pre-populate Redux state while waiting for Firebase auth check
      dispatch(setAuth(persistedAuth));
    }

    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          if (firebaseUser) {
            console.log('🔐 Firebase user authenticated:', firebaseUser.email);
            
            // Verify token freshness
            const idTokenResult = await firebaseUser.getIdTokenResult();
            const tokenAge = Date.now() - idTokenResult.issuedAtTime;
            
            if (tokenAge > 30 * 60 * 1000) { // 30 minutes
              await firebaseUser.getIdToken(true); // Force refresh
            }

            console.log('🔍 Looking up user data for:', firebaseUser.email);
            const userData = await getUserData(firebaseUser.email);
            console.log('📥 User data result:', userData ? 'found' : 'not found');
            
            if (userData) {
              // Use Google profile data for display info, fallback to database data
              const authState = {
                user: {
                  uid: userData.user_id,
                  email: userData.email,
                  displayName: firebaseUser.displayName || userData.displayName,
                  photoURL: firebaseUser.photoURL || userData.photoURL,
                  administrator: userData.administrator
                },
                isAdmin: userData.administrator,
                uid: userData.user_id,
                sessionToken: sessionToken
              };
              console.log('✅ Auth state resolved, updating Redux immediately:', authState);
              console.log('🖼️ Profile image debug:', {
                firebasePhotoURL: firebaseUser.photoURL,
                databasePhotoURL: userData.photoURL,
                finalPhotoURL: authState.user.photoURL
              });
              
              // Persist auth state for PWA
              persistAuthState(authState);
              
              // Log successful login for audit
              try {
                await auditService.logAuthEvent(
                  AUDIT_EVENTS.LOGIN_SUCCESS,
                  authState.user,
                  {
                    login_method: 'google_oauth',
                    token_age: tokenAge,
                    session_token: sessionToken
                  }
                );
              } catch (auditError) {
                console.warn('Failed to log login audit event:', auditError);
              }

              // Update Redux state immediately - this is the key fix
              dispatch(setAuth(authState));
              resolve(authState);
            } else {
              // User authenticated with Google but doesn't have an account - sign them out
              console.log('❌ User not authorized - no account found, signing out');
              await signOut(auth);
              const errorState = {
                error: 'Access denied. You do not have an authorized account.',
                unauthorized: true
              };
              
              // Update Redux state immediately
              dispatch(setAuth(null));
              dispatch(setError({ message: errorState.error }));
              resolve(errorState);
            }
          } else {
            console.log('🚪 No Firebase user, clearing auth state');
            
            // Clear any persisted auth state when no user is authenticated
            try {
              localStorage.removeItem('mcduck_auth_state');
              sessionStorage.removeItem('mcduck_auth_state');
            } catch (error) {
              console.warn('Failed to clear persisted auth state:', error);
            }
            
            // Update Redux state immediately
            dispatch(setAuth(null));
            resolve(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          
          // Update Redux state immediately  
          dispatch(setAuth(null));
          dispatch(setError({ message: 'Authentication failed' }));
          resolve(null);
        }
      });

      // Store unsubscribe function for cleanup
      window.authUnsubscribe = unsubscribe;
    });
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const state = getState();
    const currentUser = state.auth.user;
    
    // Log logout event before signing out
    if (currentUser) {
      try {
        await auditService.logAuthEvent(
          AUDIT_EVENTS.LOGOUT,
          currentUser,
          {
            logout_method: 'manual',
            session_duration: Date.now() - (state.auth.sessionToken ? 0 : Date.now()) // Approximate
          }
        );
      } catch (auditError) {
        console.warn('Failed to log logout audit event:', auditError);
      }
    }
    
    const auth = getAuth();
    localStorage.setItem('justLoggedOut', 'true');
    await signOut(auth);
    
    setTimeout(() => {
      localStorage.removeItem('justLoggedOut');
    }, 1000);
    
    localStorage.removeItem('sessionToken');
    const newSessionToken = uuidv4();
    localStorage.setItem('sessionToken', newSessionToken);
    
    return null;
  }
);

const authSlice = createSlice({
  name: 'auth',
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
    setAuth: (state, action) => {
      if (!action.payload) {
        state.isAuthenticated = false;
        state.user = null;
        state.isAdmin = false;
        state.uid = null;
        state.sessionToken = null;
        state.loading = false;
        return;
      }
      
      const { user, isAdmin, uid, sessionToken } = action.payload;
      state.isAuthenticated = !!user;
      state.user = user;
      state.isAdmin = isAdmin;
      state.uid = uid;
      state.sessionToken = sessionToken;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        // Auth state is already updated via direct dispatch calls in the thunk
        // This just ensures loading is set to false
        state.loading = false;
        
        if (action.payload?.unauthorized) {
          state.error = { message: action.payload.error };
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.isAuthenticated = false;
        state.user = null;
        state.isAdmin = false;
        state.uid = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.isAdmin = false;
        state.uid = null;
        state.error = null;
        state.sessionToken = localStorage.getItem('sessionToken');
        state.loading = false;
      });
  },
});

export const { setLoading, setError, clearError, setAuth } = authSlice.actions;
export default authSlice.reducer;
