# McDuck Bank Data Migration

This directory contains scripts to migrate data from your old Firebase project to the new clean project.

## 🚀 Quick Start

### 1. Setup Migration Environment

```bash
cd migration
npm install
```

### 2. Get Service Account Keys

#### For Old Project:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your **old project**
3. Go to **Project Settings** > **Service Accounts**
4. Click **"Generate new private key"**
5. Save as `old-project-service-account.json` in this directory

#### For New Project:
1. Go to [Firebase Console](https://console.firebase.google.com) 
2. Select your **new project**
3. Go to **Project Settings** > **Service Accounts**
4. Click **"Generate new private key"**
5. Save as `new-project-service-account.json` in this directory

### 3. Configure Migration Script

Edit `migrate-data.js` and update the CONFIG object:

```javascript
const CONFIG = {
  sourceProject: {
    serviceAccountPath: './old-project-service-account.json',
    projectId: 'your-old-project-id' // ← Update this
  },
  destProject: {
    serviceAccountPath: './new-project-service-account.json', 
    projectId: 'your-new-project-id' // ← Update this
  },
  collections: ['accounts', 'transactions', 'system', 'job_logs'],
  batchSize: 500
};
```

### 4. Run Migration

```bash
npm run migrate
```

## 📊 What Gets Migrated

### Collections:
- ✅ **accounts** - User account data
- ✅ **transactions** - Transaction history  
- ✅ **system** - Configuration (interest rates, etc.)
- ✅ **job_logs** - Execution logs (if exists)

### Data Cleaning:
- ✅ **Timestamp normalization** - Converts all timestamp formats
- ✅ **Field validation** - Ensures required fields exist
- ✅ **Type conversion** - Fixes data type issues
- ✅ **Null handling** - Removes undefined values

## 🔍 Verification

The script automatically verifies migration by comparing document counts:

```
✅ accounts: 25 → 25
✅ transactions: 1,547 → 1,547  
✅ system: 1 → 1
✅ job_logs: 12 → 12
```

## 🛡️ Safety Features

- **Batch processing** - Handles large datasets efficiently
- **Error handling** - Continues migration even if some documents fail
- **Data validation** - Cleans and validates all migrated data
- **Verification** - Confirms migration success
- **No source modification** - Only reads from old project

## 🔧 Troubleshooting

### Common Issues:

1. **"Permission denied"**
   - Ensure service account keys have proper permissions
   - Check that Firestore is enabled in both projects

2. **"Collection not found"**
   - Some collections may not exist in old project
   - Edit CONFIG.collections to remove non-existent collections

3. **"Timestamp conversion errors"**
   - Script handles most timestamp formats automatically
   - Check logs for specific problematic documents

4. **"Document count mismatch"**
   - Some documents may have failed validation
   - Check error logs for details
   - Manually verify critical documents

### Debug Mode:

Add more logging by setting environment variable:
```bash
DEBUG=true npm run migrate
```

## 📁 File Structure

```
migration/
├── migrate-data.js           # Main migration script
├── package.json             # Dependencies
├── README.md               # This file
├── old-project-service-account.json  # Your old project key
└── new-project-service-account.json  # Your new project key
```

## 🗑️ Cleanup

After successful migration:

1. **Test the new project thoroughly**
2. **Delete service account keys** (sensitive data)
3. **Archive old project** (don't delete immediately)
4. **Update app configuration** to use new project

## 🆘 Need Help?

If migration fails:

1. Check the error logs in console output
2. Verify service account permissions
3. Ensure both projects have Firestore enabled
4. Try migrating collections individually
5. Contact support with specific error messages

The migration script is designed to be safe and resumable. You can run it multiple times if needed.