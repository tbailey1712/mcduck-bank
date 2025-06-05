# UID Mapping Fix - Post Migration

After migrating to a new Firebase project, users get new UIDs when they authenticate, but the database still contains old user_id values. This causes "access denied" errors because the authentication system can't match users to their accounts.

## The Problem

1. **Old Project**: User authenticates → gets UID `abc123` → database stores `user_id: abc123`
2. **New Project**: Same user authenticates → gets NEW UID `xyz789` → database still has `user_id: abc123`
3. **Result**: Authentication fails because `xyz789 ≠ abc123`

## The Solution

The `fix-uid-mapping.js` script updates the database to use the new UIDs by:

1. **Mapping emails to new UIDs**: Uses Firebase Auth to get current UID for each user's email
2. **Updating accounts collection**: Changes `user_id` field to match new UIDs
3. **Updating transactions collection**: Changes `user_id` field in all transaction records

## Prerequisites

1. **Service Account Key**: Download from Firebase Console → Project Settings → Service Accounts
2. **Admin Access**: Ensure the service account has Firestore Admin permissions
3. **Backup**: The script creates automatic backups, but have your own backup ready

## Usage

### Step 1: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your **new** Firebase project
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Save as `serviceAccountKey.json` in the `migration/` folder

### Step 2: Install Dependencies

```bash
cd migration
npm install firebase-admin
```

### Step 3: Run the Fix

```bash
cd migration
node fix-uid-mapping.js
```

### Step 4: Test Authentication

After the script completes:

1. Clear browser cache/localStorage
2. Try logging in with your Google account
3. Verify you can access your account data

## What the Script Does

### 🔍 **Discovery Phase**
- Lists all users from Firebase Auth (new UIDs)
- Reads all accounts from Firestore (old user_ids)
- Maps email addresses to create UID translation table

### 📦 **Backup Phase**
- Creates backup files in `uid-migration-backup/` folder
- Backs up both accounts and transactions collections

### 🔄 **Update Phase**
- Updates `user_id` in accounts collection (batched for performance)
- Updates `user_id` in transactions collection (batched for performance)
- Processes large datasets efficiently to avoid timeouts

### ✅ **Verification Phase**
- Samples a few records to confirm updates worked
- Reports statistics on changes made

## Example Output

```
🚀 Starting UID Mapping Fix...
✅ Firebase Admin SDK initialized successfully
📦 Creating backup of current data...
✅ Backup created in uid-migration-backup/
🔍 Building UID mapping from email addresses...
✅ Found 15 users in Firebase Auth
✅ Built UID mapping for 15 users

📋 UID Mapping Preview:
   user_001 → 9K8f2mxY3ZcV1pQ4nR7sE2tA
   user_002 → 3L9m6NyP8QvR5zX1bC4dF7hK
   user_003 → 7B2n9VcM4KqL8pY5xT1nE3sA
   ... and 12 more

🔄 Updating accounts collection...
✅ Total accounts updated: 15

🔄 Updating transactions collection...
✅ Updated 50 transactions (total: 50)
✅ Total transactions updated: 487

🔍 Verifying updates...
✅ Account user1@example.com: 9K8f2mxY3ZcV1pQ4nR7sE2tA (correct)
✅ Account user2@example.com: 3L9m6NyP8QvR5zX1bC4dF7hK (correct)

🎉 UID Mapping Fix Complete!
✅ Users processed: 15
✅ Accounts updated: 15
✅ Transactions updated: 487
```

## Troubleshooting

### Permission Denied
- Verify service account key is correct
- Check that service account has Firestore Admin role
- Ensure you're using the NEW project's service account

### No Users Found
- Make sure users have logged into the new project at least once
- Check that Firebase Auth is properly configured in new project

### Script Hangs
- Large databases may take time
- Check Firestore quotas in Firebase Console
- Script includes automatic batching and delays

## Safety Features

- **Automatic Backups**: Creates JSON backups before any changes
- **Batched Operations**: Processes in small batches to avoid timeouts
- **Verification**: Checks results after updates
- **Error Handling**: Logs errors and continues processing
- **10-second Warning**: Gives you time to cancel before starting

## Recovery

If something goes wrong, you can restore from backups:

```bash
cd migration/uid-migration-backup
# Use the JSON files to restore data if needed
```

The backup files contain the complete original data structure.

## Post-Fix Steps

1. **Test All Users**: Have each user log in to verify access
2. **Check Admin Access**: Ensure admin users can still access admin features
3. **Verify Transactions**: Spot-check that transaction history is intact
4. **Monitor Logs**: Watch for any authentication errors

## Alternative: Manual UID Update

If the script doesn't work for your setup, you can manually update UIDs in the Firebase Console:

1. Note the new UID when a user logs in (check browser dev tools)
2. Find their account in Firestore Console
3. Update the `user_id` field manually
4. Find their transactions and update those `user_id` fields

This is tedious but works for small user bases.