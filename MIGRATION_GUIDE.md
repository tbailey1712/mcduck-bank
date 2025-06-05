# McDuck Bank Migration Guide
## Moving to a New Firebase Project

This guide walks you through creating a new Firebase project and migrating your data from the legacy implementation.

## 🚀 Phase 1: Create New Firebase Project

### 1. Create New Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"**
3. **Project name**: `mcduck-bank-2025` (or your preferred name)
4. **Project ID**: Will be auto-generated (note this down!)
5. **Enable Google Analytics**: Yes (recommended)
6. **Analytics location**: Your region
7. Click **"Create project"**

### 2. Enable Required Services
1. **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable **Google** provider
   - Add your domain to authorized domains

2. **Firestore Database**:
   - Go to Firestore Database
   - Click **"Create database"**
   - Choose **"Start in production mode"**
   - Select your **region** (choose closest to users)

3. **Hosting** (optional):
   - Go to Hosting
   - Click **"Get started"**
   - Follow setup steps

### 3. Install Firebase CLI & Initialize
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize new project in your app directory
cd /Users/tbailey/Dev/mcduck-bank-2025/mcduck-bank
firebase init

# Select services:
# [x] Firestore
# [x] Functions
# [x] Hosting (optional)

# Choose "Use an existing project" and select your new project
# Accept default settings for Firestore rules and indexes
# Choose TypeScript: No (keep JavaScript)
# Install dependencies: Yes
```

## 🗃️ Phase 2: Database Migration

### Option A: Automated Migration Script

Create a migration script to copy data:

```bash
# Create migration directory
mkdir migration
cd migration
npm init -y
npm install firebase-admin
```

Create `migrate.js`:
```javascript
const admin = require('firebase-admin');

// Initialize source (old) project
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(require('./old-project-key.json'))
}, 'source');
const sourceDb = admin.firestore(sourceApp);

// Initialize destination (new) project  
const destApp = admin.initializeApp({
  credential: admin.credential.cert(require('./new-project-key.json'))
}, 'dest');
const destDb = admin.firestore(destApp);

async function migrateCollection(collectionName) {
  console.log(`Migrating ${collectionName}...`);
  
  const sourceCollection = await sourceDb.collection(collectionName).get();
  const batch = destDb.batch();
  
  sourceCollection.forEach(doc => {
    const newDocRef = destDb.collection(collectionName).doc(doc.id);
    batch.set(newDocRef, doc.data());
  });
  
  await batch.commit();
  console.log(`✅ ${collectionName}: ${sourceCollection.size} documents migrated`);
}

async function migrate() {
  try {
    // Migrate all collections
    await migrateCollection('accounts');
    await migrateCollection('transactions');
    await migrateCollection('system');
    await migrateCollection('job_logs'); // if exists
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrate();
```

### Option B: Manual Export/Import

```bash
# Export from old project
firebase use old-project-id
firebase firestore:export gs://old-project-bucket/backup

# Import to new project
firebase use new-project-id
firebase firestore:import gs://new-project-bucket/backup
```

### Option C: Firestore Data Viewer (Small datasets)

For small datasets, manually copy via Firebase Console:
1. Open old project in one tab
2. Open new project in another tab
3. Navigate to Firestore in both
4. Copy collections manually

## 🔧 Phase 3: Update Configuration

### 1. Update Firebase Config
Create new `src/config/firebaseConfig.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "your-new-api-key",
  authDomain: "your-new-project.firebaseapp.com", 
  projectId: "your-new-project-id",
  storageBucket: "your-new-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-new-app-id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
```

### 2. Update Environment Variables
Create `.env.local`:
```bash
REACT_APP_PROJECT_ID=your-new-project-id
REACT_APP_FUNCTIONS_URL=https://us-central1-your-new-project-id.cloudfunctions.net
```

### 3. Update Package.json Scripts
```json
{
  "scripts": {
    "build": "react-scripts build",
    "deploy": "npm run build && firebase deploy",
    "deploy:hosting": "npm run build && firebase deploy --only hosting",
    "deploy:functions": "firebase deploy --only functions",
    "emulator": "firebase emulators:start"
  }
}
```

## ☁️ Phase 4: Deploy Cloud Functions

### 1. Configure Functions Environment
```bash
cd functions

# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="your_sendgrid_api_key"

# Set from email
firebase functions:config:set email.from="noreply@yourdomain.com"

# Set site URL
firebase functions:config:set site.url="https://your-new-project.web.app"
```

### 2. Deploy Functions
```bash
firebase deploy --only functions
```

### 3. Note Function URLs
After deployment, note the URLs for Cloud Scheduler:
- Interest: `https://us-central1-NEW-PROJECT-ID.cloudfunctions.net/calculateInterest`
- Statements: `https://us-central1-NEW-PROJECT-ID.cloudfunctions.net/sendMonthlyStatements`

## 🌐 Phase 5: Deploy Web App

### 1. Build and Deploy
```bash
# Build the React app
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

### 2. Configure Custom Domain (Optional)
1. Go to Hosting in Firebase Console
2. Add custom domain
3. Follow DNS configuration steps

## ⏰ Phase 6: Set Up Automation

### 1. Google Cloud Scheduler
1. Go to [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler)
2. Select your **new project**
3. Create jobs with your new function URLs:

**Interest Payment Job:**
- Name: `monthly-interest-payment`
- Frequency: `0 2 1 * *`
- URL: `https://us-central1-NEW-PROJECT-ID.cloudfunctions.net/calculateInterest`
- Method: POST

**Monthly Statements Job:**
- Name: `monthly-statements`  
- Frequency: `0 3 1 * *`
- URL: `https://us-central1-NEW-PROJECT-ID.cloudfunctions.net/sendMonthlyStatements`
- Method: POST

### 2. Test Automation
```bash
# Test functions manually first
curl -X POST https://us-central1-NEW-PROJECT-ID.cloudfunctions.net/healthCheck
curl -X POST https://us-central1-NEW-PROJECT-ID.cloudfunctions.net/calculateInterest
```

## 🔒 Phase 7: Security Configuration

### 1. Firestore Security Rules
Update `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own account data
    match /accounts/{email} {
      allow read, write: if request.auth != null && 
        (request.auth.token.email == resource.id || 
         request.auth.token.administrator == true);
    }
    
    // Users can read their own transactions, admins can read all
    match /transactions/{transactionId} {
      allow read: if request.auth != null && 
        (resource.data.user_id == request.auth.uid ||
         request.auth.token.administrator == true);
      allow write: if request.auth != null && 
        request.auth.token.administrator == true;
    }
    
    // Only admins can access system config
    match /system/{document} {
      allow read, write: if request.auth != null && 
        request.auth.token.administrator == true;
    }
    
    // Only admins can read job logs
    match /job_logs/{logId} {
      allow read: if request.auth != null && 
        request.auth.token.administrator == true;
    }
  }
}
```

### 2. Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```

## 📊 Phase 8: Verification

### 1. Test Core Features
- [ ] Google OAuth login
- [ ] Account overview displays correctly
- [ ] Transactions load properly
- [ ] Admin panel functions work
- [ ] Interest calculation runs
- [ ] Statements generate and send

### 2. Verify Data Migration
- [ ] All accounts migrated
- [ ] All transactions present
- [ ] System config preserved
- [ ] Balances calculate correctly

### 3. Test Automation
- [ ] Cloud functions deploy successfully
- [ ] Manual function calls work
- [ ] Email sending functions
- [ ] Cron jobs scheduled

## 🧹 Phase 9: Clean Up Legacy

### 1. Update DNS (if using custom domain)
Point your domain to the new Firebase Hosting

### 2. Archive Old Project
1. Download final backup of old project
2. Document any custom configurations
3. Eventually delete old project (after confirming new one works)

### 3. Update Documentation
- Update README with new project details
- Update any deployment scripts
- Share new URLs with stakeholders

## 🚀 Expected Benefits

### Performance Improvements
- ✅ **Faster cold starts** - Modern Firebase Functions
- ✅ **Better caching** - Optimized Firestore queries
- ✅ **Reduced bundle size** - Removed legacy dependencies

### Maintainability 
- ✅ **Clean codebase** - No legacy technical debt
- ✅ **Modern patterns** - Latest React/Firebase practices
- ✅ **Better structure** - Organized service layers

### Cost Optimization
- ✅ **Reduced function calls** - More efficient operations
- ✅ **Better resource usage** - Right-sized functions
- ✅ **Optimized storage** - Clean data structure

### Security Enhancements
- ✅ **Updated dependencies** - Latest security patches
- ✅ **Improved rules** - Tighter Firestore security
- ✅ **Better authentication** - Modern auth patterns

## 📞 Need Help?

If you encounter issues during migration:

1. **Check Firebase Console logs**
2. **Verify authentication configuration** 
3. **Test functions individually**
4. **Check Firestore security rules**
5. **Verify environment variables**

The migration should be straightforward with proper planning. Take it step by step and test each phase before proceeding to the next! 🎯