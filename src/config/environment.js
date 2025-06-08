/**
 * Environment configuration utility
 * Centralizes access to environment variables with validation and defaults
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Helper function to get boolean env vars
const getBooleanEnv = (key, defaultValue = false) => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Helper function to get required env vars
const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// Environment configuration object
export const config = {
  // Environment flags
  isDevelopment,
  isProduction,
  
  // Firebase configuration
  firebase: {
    apiKey: getRequiredEnv('REACT_APP_FIREBASE_API_KEY'),
    authDomain: getRequiredEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
    projectId: getRequiredEnv('REACT_APP_FIREBASE_PROJECT_ID'),
    storageBucket: getRequiredEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getRequiredEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getRequiredEnv('REACT_APP_FIREBASE_APP_ID'),
  },
  
  // Development settings
  development: {
    useEmulator: getBooleanEnv('REACT_APP_USE_FIREBASE_EMULATOR', false),
    enableDebug: getBooleanEnv('REACT_APP_ENABLE_DEBUG', isDevelopment),
    enableErrorReporting: getBooleanEnv('REACT_APP_ENABLE_ERROR_REPORTING', false),
  },
  
  // Security settings
  security: {
    // In production, never log sensitive information
    enableConsoleLogging: isDevelopment,
    // Enable additional security headers
    enableSecurityHeaders: isProduction,
  },
  
  // App settings
  app: {
    name: 'McDuck Bank',
    version: process.env.REACT_APP_VERSION || '1.0.0',
    buildDate: process.env.REACT_APP_BUILD_DATE || new Date().toISOString(),
  },
  
  // UI settings
  ui: {
    navbar: {
      showBuildNumber: getBooleanEnv('REACT_APP_SHOW_BUILD_NUMBER', true),
      showNavigation: getBooleanEnv('REACT_APP_SHOW_NAVBAR_NAVIGATION', false),
    }
  }
};

// Validation function to check configuration
export const validateConfig = () => {
  const errors = [];
  
  // Validate Firebase config
  if (!config.firebase.apiKey.startsWith('AIza')) {
    errors.push('Invalid Firebase API key format');
  }
  
  if (!config.firebase.projectId.match(/^[a-z0-9-]+$/)) {
    errors.push('Invalid Firebase project ID format');
  }
  
  if (!config.firebase.authDomain.endsWith('.firebaseapp.com')) {
    errors.push('Invalid Firebase auth domain format');
  }
  
  // Log warnings for development
  if (config.isDevelopment && errors.length > 0) {
    console.warn('Configuration warnings:', errors);
  }
  
  return errors;
};

// Initialize and validate configuration
validateConfig();

// Export debug information (safe for logging)
export const getConfigInfo = () => ({
  environment: process.env.NODE_ENV,
  projectId: config.firebase.projectId,
  authDomain: config.firebase.authDomain,
  useEmulator: config.development.useEmulator,
  appVersion: config.app.version,
  buildDate: config.app.buildDate,
});

export default config;