# Security Guidelines

## Environment Variables

### Setup
1. Copy `.env.example` to `.env`
2. Fill in your actual Firebase configuration values
3. **Never commit `.env` to version control**

### Firebase Configuration Security

#### ✅ Safe Practices
- Store Firebase config in environment variables prefixed with `REACT_APP_`
- Use the centralized `config/environment.js` for all environment access
- Validate environment variables on app startup
- Use Firebase security rules to protect data access

#### ❌ Dangerous Practices
- **Never** hardcode API keys in source code
- **Never** commit `.env` files to git
- **Never** expose admin credentials in client code
- **Never** disable Firebase security rules in production

### Production Deployment

#### Environment Variables in Production
```bash
# Set these in your deployment platform (GCP, Vercel, etc.)
REACT_APP_FIREBASE_API_KEY=your-production-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-production-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-production-app-id

# Production security settings
REACT_APP_USE_FIREBASE_EMULATOR=false
REACT_APP_ENABLE_DEBUG=false
REACT_APP_ENABLE_ERROR_REPORTING=true
```

#### Firebase Security Rules
Ensure your Firestore security rules are properly configured:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own account data
    match /accounts/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can only access their own transactions
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.user_id;
    }
    
    // Admin access (implement based on custom claims)
    match /{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
```

## API Key Security

### Client-Side API Keys
Firebase client API keys are **safe to expose** in client-side code because:
- They identify your Firebase project, not authenticate admin access
- Security is enforced by Firebase security rules and authentication
- They're restricted by domain and bundle ID

### What to Keep Secret
- **Service Account Keys**: Never expose server-side credentials
- **Database URLs**: Use environment variables
- **Third-party API keys**: Store securely on server-side

## Authentication Security

### Best Practices
- Use Firebase Auth for user authentication
- Implement proper session management
- Use HTTPS in production
- Validate user permissions server-side (Firebase security rules)

### Token Management
- Firebase automatically handles token refresh
- Tokens expire automatically (1 hour by default)
- Use Firebase security rules for authorization

## Development vs Production

### Development
- Use `.env` for local configuration
- Enable debug logging
- Use Firebase emulators when needed

### Production
- Set environment variables in deployment platform
- Disable debug logging
- Use production Firebase project
- Enable error reporting
- Implement proper monitoring

## Incident Response

### If API Keys are Compromised
1. **Immediately** regenerate API keys in Firebase console
2. Update environment variables in all deployments
3. Review Firebase security rules
4. Check for unauthorized access in Firebase console
5. Rotate any other potentially compromised credentials

### Monitoring
- Monitor Firebase usage in the console
- Set up alerts for unusual activity
- Regularly review security rules
- Keep dependencies updated

## Contact
For security issues, please contact the development team immediately.