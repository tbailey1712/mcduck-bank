import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import config from './environment';

// Use validated configuration from environment utility
const firebaseConfig = config.firebase;

// Initialize Firebase only if not already initialized
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  throw new Error('Firebase initialization failed. Please check your configuration.');
}

// Initialize Auth, Firestore, and Functions
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

// Set Firebase Auth persistence for PWAs
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Failed to set auth persistence:', error);
});

// Connect to emulators in development (if configured)
if (config.isDevelopment && config.development.useEmulator) {
  try {
    // Connect to Auth emulator
    if (!auth._delegate._config.emulator) {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
    
    // Connect to Firestore emulator
    if (!db._delegate._settings?.host?.includes('localhost')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    
    // Connect to Functions emulator
    if (!functions._delegate._options?.customDomain?.includes('localhost')) {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
    
    if (config.development.enableDebug) {
      console.log('Connected to Firebase emulators');
    }
  } catch (error) {
    if (config.development.enableDebug) {
      console.warn('Failed to connect to Firebase emulators:', error.message);
    }
  }
}

// Export configuration for debugging (without sensitive data)
export const getFirebaseInfo = () => ({
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  isEmulator: config.development.useEmulator,
  environment: config.isDevelopment ? 'development' : 'production',
  debugEnabled: config.development.enableDebug
});

export default app;
