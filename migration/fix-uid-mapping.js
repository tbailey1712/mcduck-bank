#!/usr/bin/env node

/**
 * UID Mapping Fix Script
 * 
 * This script fixes the UID mismatch issue that occurs after migrating to a new Firebase project.
 * When users authenticate with the new project, they get new UIDs, but the database still contains
 * the old user_id values, causing "access denied" errors.
 * 
 * This script updates the user_id fields in both the accounts and transactions collections
 * to match the new Firebase Auth UIDs based on email addresses.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Service account key file (should be downloaded from Firebase Console)
  serviceAccountKeyPath: './serviceAccountKey.json',
  
  // Batch size for Firestore operations
  batchSize: 500,
  
  // Collections to update
  collections: {
    accounts: 'accounts',
    transactions: 'transactions'
  },
  
  // Backup settings
  createBackup: true,
  backupDir: './uid-migration-backup'
};

class UIDMappingFixer {
  constructor() {
    this.db = null;
    this.auth = null;
    this.emailToNewUID = new Map();
    this.oldUIDToNewUID = new Map();
    this.stats = {
      usersProcessed: 0,
      accountsUpdated: 0,
      transactionsUpdated: 0,
      errors: []
    };
  }

  async initialize() {
    try {
      // Check if service account key exists
      if (!fs.existsSync(CONFIG.serviceAccountKeyPath)) {
        throw new Error(`Service account key file not found: ${CONFIG.serviceAccountKeyPath}`);
      }

      // Initialize Firebase Admin SDK
      const serviceAccount = require(path.resolve(CONFIG.serviceAccountKeyPath));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

      this.db = admin.firestore();
      this.auth = admin.auth();
      
      console.log('✅ Firebase Admin SDK initialized successfully');
      console.log(`📊 Project ID: ${serviceAccount.project_id}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
      throw error;
    }
  }

  async createBackup() {
    if (!CONFIG.createBackup) return;

    try {
      // Create backup directory
      if (!fs.existsSync(CONFIG.backupDir)) {
        fs.mkdirSync(CONFIG.backupDir, { recursive: true });
      }

      console.log('📦 Creating backup of current data...');

      // Backup accounts collection
      const accountsSnapshot = await this.db.collection(CONFIG.collections.accounts).get();
      const accountsData = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      fs.writeFileSync(
        path.join(CONFIG.backupDir, 'accounts-backup.json'),
        JSON.stringify(accountsData, null, 2)
      );

      // Backup transactions collection
      const transactionsSnapshot = await this.db.collection(CONFIG.collections.transactions).get();
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      fs.writeFileSync(
        path.join(CONFIG.backupDir, 'transactions-backup.json'),
        JSON.stringify(transactionsData, null, 2)
      );

      console.log(`✅ Backup created in ${CONFIG.backupDir}`);
      console.log(`   - Accounts: ${accountsData.length} records`);
      console.log(`   - Transactions: ${transactionsData.length} records`);

    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
      throw error;
    }
  }

  async buildUIDMapping() {
    try {
      console.log('🔍 Building UID mapping from email addresses...');

      // Get all users from Firebase Auth
      const listUsersResult = await this.auth.listUsers();
      
      for (const userRecord of listUsersResult.users) {
        if (userRecord.email) {
          this.emailToNewUID.set(userRecord.email.toLowerCase(), userRecord.uid);
        }
      }

      console.log(`✅ Found ${this.emailToNewUID.size} users in Firebase Auth`);

      // Get all accounts from Firestore
      const accountsSnapshot = await this.db.collection(CONFIG.collections.accounts).get();
      
      for (const doc of accountsSnapshot.docs) {
        const data = doc.data();
        if (data.email) {
          const email = data.email.toLowerCase();
          const newUID = this.emailToNewUID.get(email);
          
          if (newUID) {
            // Map old user_id (or document ID) to new UID
            const oldUID = data.user_id || doc.id;
            this.oldUIDToNewUID.set(oldUID, newUID);
            this.stats.usersProcessed++;
          } else {
            console.warn(`⚠️  No Firebase Auth user found for email: ${email}`);
            this.stats.errors.push(`No Auth user for email: ${email}`);
          }
        }
      }

      console.log(`✅ Built UID mapping for ${this.oldUIDToNewUID.size} users`);
      
      // Log the mapping for verification
      console.log('📋 UID Mapping Preview:');
      let count = 0;
      for (const [oldUID, newUID] of this.oldUIDToNewUID) {
        if (count < 5) { // Show first 5 mappings
          console.log(`   ${oldUID} → ${newUID}`);
          count++;
        }
      }
      if (this.oldUIDToNewUID.size > 5) {
        console.log(`   ... and ${this.oldUIDToNewUID.size - 5} more`);
      }

    } catch (error) {
      console.error('❌ Failed to build UID mapping:', error.message);
      throw error;
    }
  }

  async updateAccounts() {
    try {
      console.log('🔄 Updating accounts collection...');

      const accountsSnapshot = await this.db.collection(CONFIG.collections.accounts).get();
      const batch = this.db.batch();
      let batchCount = 0;

      for (const doc of accountsSnapshot.docs) {
        const data = doc.data();
        const oldUID = data.user_id || doc.id;
        const newUID = this.oldUIDToNewUID.get(oldUID);

        if (newUID && newUID !== oldUID) {
          // Update user_id to new UID
          batch.update(doc.ref, { user_id: newUID });
          batchCount++;
          this.stats.accountsUpdated++;

          // If we've reached batch size, commit and start new batch
          if (batchCount >= CONFIG.batchSize) {
            await batch.commit();
            console.log(`   ✅ Updated ${batchCount} accounts`);
            batchCount = 0;
          }
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Updated ${batchCount} accounts`);
      }

      console.log(`✅ Total accounts updated: ${this.stats.accountsUpdated}`);

    } catch (error) {
      console.error('❌ Failed to update accounts:', error.message);
      throw error;
    }
  }

  async updateTransactions() {
    try {
      console.log('🔄 Updating transactions collection...');

      // Process transactions in batches to avoid memory issues
      let lastDoc = null;
      let totalUpdated = 0;

      do {
        let query = this.db.collection(CONFIG.collections.transactions)
          .orderBy('timestamp')
          .limit(CONFIG.batchSize);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        
        if (snapshot.empty) break;

        const batch = this.db.batch();
        let batchUpdates = 0;

        for (const doc of snapshot.docs) {
          const data = doc.data();
          const oldUID = data.user_id;
          const newUID = this.oldUIDToNewUID.get(oldUID);

          if (newUID && newUID !== oldUID) {
            batch.update(doc.ref, { user_id: newUID });
            batchUpdates++;
            this.stats.transactionsUpdated++;
          }
        }

        if (batchUpdates > 0) {
          await batch.commit();
          totalUpdated += batchUpdates;
          console.log(`   ✅ Updated ${batchUpdates} transactions (total: ${totalUpdated})`);
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        // Small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));

      } while (true);

      console.log(`✅ Total transactions updated: ${this.stats.transactionsUpdated}`);

    } catch (error) {
      console.error('❌ Failed to update transactions:', error.message);
      throw error;
    }
  }

  async verifyUpdates() {
    try {
      console.log('🔍 Verifying updates...');

      // Check a few accounts to ensure they were updated correctly
      const accountsSnapshot = await this.db.collection(CONFIG.collections.accounts).limit(5).get();
      
      for (const doc of accountsSnapshot.docs) {
        const data = doc.data();
        const email = data.email;
        const userID = data.user_id;
        const expectedUID = this.emailToNewUID.get(email?.toLowerCase());
        
        if (expectedUID && userID === expectedUID) {
          console.log(`   ✅ Account ${email}: ${userID} (correct)`);
        } else {
          console.log(`   ❌ Account ${email}: ${userID} (expected: ${expectedUID})`);
        }
      }

      // Check a few transactions
      const transactionsSnapshot = await this.db.collection(CONFIG.collections.transactions).limit(5).get();
      
      for (const doc of transactionsSnapshot.docs) {
        const data = doc.data();
        const userID = data.user_id;
        const hasMapping = this.oldUIDToNewUID.has(userID) || [...this.oldUIDToNewUID.values()].includes(userID);
        
        console.log(`   ${hasMapping ? '✅' : '❓'} Transaction ${doc.id}: user_id = ${userID}`);
      }

    } catch (error) {
      console.error('❌ Failed to verify updates:', error.message);
    }
  }

  async run() {
    try {
      console.log('🚀 Starting UID Mapping Fix...');
      console.log('=====================================');

      await this.initialize();
      await this.createBackup();
      await this.buildUIDMapping();
      
      if (this.oldUIDToNewUID.size === 0) {
        console.log('ℹ️  No UID mappings needed. All users may already be correctly mapped.');
        return;
      }

      console.log('\n⚠️  IMPORTANT: This will modify your database!');
      console.log('   Make sure you have backed up your data.');
      console.log(`   ${this.stats.usersProcessed} users will be processed`);
      console.log('\nPress Ctrl+C to cancel, or wait 10 seconds to continue...');
      
      await new Promise(resolve => setTimeout(resolve, 10000));

      await this.updateAccounts();
      await this.updateTransactions();
      await this.verifyUpdates();

      console.log('\n🎉 UID Mapping Fix Complete!');
      console.log('=====================================');
      console.log(`✅ Users processed: ${this.stats.usersProcessed}`);
      console.log(`✅ Accounts updated: ${this.stats.accountsUpdated}`);
      console.log(`✅ Transactions updated: ${this.stats.transactionsUpdated}`);
      
      if (this.stats.errors.length > 0) {
        console.log(`⚠️  Errors encountered: ${this.stats.errors.length}`);
        this.stats.errors.forEach(error => console.log(`   - ${error}`));
      }

    } catch (error) {
      console.error('\n❌ UID Mapping Fix Failed:', error.message);
      console.log('\n🔄 To retry:');
      console.log('1. Check your service account key file');
      console.log('2. Verify Firebase project access');
      console.log('3. Run the script again');
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const fixer = new UIDMappingFixer();
  fixer.run().catch(console.error);
}

module.exports = UIDMappingFixer;