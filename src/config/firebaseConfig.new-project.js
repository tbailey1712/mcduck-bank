import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration for NEW clean project
// Replace these values with your new project's config from Firebase Console
const firebaseConfig = {
  apiKey: "your-new-api-key-here",
  authDomain: "your-new-project.firebaseapp.com",
  projectId: "your-new-project-id",
  storageBucket: "your-new-project.appspot.com", 
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service  
export const db = getFirestore(app);

export default app;

/* 
🔧 SETUP INSTRUCTIONS:

1. Create new Firebase project at https://console.firebase.google.com
2. Go to Project Settings > General > Your Apps
3. Click "Add app" and select Web (</>) 
4. Register your app with a nickname
5. Copy the firebaseConfig object values above
6. Replace the existing firebaseConfig.js with this file
7. Update the values with your actual project config

🔒 SECURITY NOTES:
- These values are safe to commit (they're public anyway)
- Real security comes from Firestore rules
- Never commit private keys or service accounts
*/