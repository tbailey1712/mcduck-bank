#!/usr/bin/env node

/**
 * Quick UID Fix Script
 * 
 * This script fixes UID mismatches after Firebase project migration.
 * It updates your specific account to use the correct Firebase Auth UID.
 */

const admin = require('firebase-admin');

// Values from your console debug output
const YOUR_EMAIL = 'tony.bailey@gmail.com';
const OLD_UID = 'sSUJ8VntsQfPu9h4XYEcsxl6ZRl2'; // From Redux user.uid
const NEW_UID = 'TJEZ0fCPMESFez0HNCl0dEu8UlA3'; // From Firebase Auth UID

async function quickUIDFix() {
  try {
    // Initialize Firebase Admin with service account
    if (!admin.apps.length) {
      try {
        const serviceAccount = require('./serviceAccountKey.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log('✅ Firebase Admin initialized with service account');
      } catch (error) {
        console.log('❌ Failed to load service account:', error.message);
        console.log('   Make sure serviceAccountKey.json exists in the migration folder');
        console.log('   Download from: Firebase Console → Project Settings → Service Accounts');
        return;
      }
    }

    const db = admin.firestore();
    const auth = admin.auth();

    console.log('🔍 Looking for your account...');

    // Find your account by email
    const accountsSnapshot = await db.collection('accounts')
      .where('email', '==', YOUR_EMAIL)
      .get();

    if (accountsSnapshot.empty) {
      console.log('❌ No account found with email:', YOUR_EMAIL);
      return;
    }

    const accountDoc = accountsSnapshot.docs[0];
    const accountData = accountDoc.data();
    
    console.log('✅ Found account:');
    console.log('   Document ID:', accountDoc.id);
    console.log('   Current user_id:', accountData.user_id);
    console.log('   Email:', accountData.email);
    console.log('   Administrator:', accountData.administrator);

    // We know the correct UID from browser debug output
    const currentUID = NEW_UID;
    console.log('✅ Target Firebase Auth UID:', currentUID);

    // Check if they match
    if (accountData.user_id === currentUID) {
      console.log('✅ UIDs already match! No fix needed.');
      return;
    }

    console.log('❌ UID mismatch detected:');
    console.log('   Database user_id:', accountData.user_id);
    console.log('   Target UID:', currentUID);
    console.log('   Expected old UID:', OLD_UID);

    console.log('\n⚠️  ABOUT TO UPDATE DATABASE:');
    console.log('   This will change your user_id in accounts and transactions');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update the account with UID and current Firebase profile data
    console.log('🔧 Updating account user_id and profile data...');
    const updateData = { user_id: currentUID };
    
    // Also update profile data if available from current Firebase user
    try {
      const currentFirebaseUser = await auth.getUserByEmail(YOUR_EMAIL);
      if (currentFirebaseUser.displayName && !accountData.displayName) {
        updateData.displayName = currentFirebaseUser.displayName;
      }
      if (currentFirebaseUser.photoURL && !accountData.photoURL) {
        updateData.photoURL = currentFirebaseUser.photoURL;
      }
      console.log('📝 Also updating profile data:', updateData);
    } catch (profileError) {
      console.log('⚠️ Could not get current profile data, just updating UID');
    }
    
    await accountDoc.ref.update(updateData);

    // Update transactions - look for both possible old UIDs
    console.log('🔧 Updating transactions...');
    const transactionsSnapshot1 = await db.collection('transactions')
      .where('user_id', '==', accountData.user_id)
      .get();
    
    const transactionsSnapshot2 = await db.collection('transactions')
      .where('user_id', '==', OLD_UID)
      .get();

    const allTransactionDocs = [...transactionsSnapshot1.docs, ...transactionsSnapshot2.docs];
    
    // Remove duplicates
    const uniqueTransactions = allTransactionDocs.filter((doc, index, self) => 
      index === self.findIndex(d => d.id === doc.id)
    );

    console.log(`   Found ${uniqueTransactions.length} transactions to update`);

    const batch = db.batch();
    uniqueTransactions.forEach(doc => {
      batch.update(doc.ref, { user_id: currentUID });
    });

    if (uniqueTransactions.length > 0) {
      await batch.commit();
      console.log(`✅ Updated ${uniqueTransactions.length} transactions`);
    }

    console.log('🎉 UID fix complete!');
    console.log('   Try logging into the admin panel again.');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.log('\n🔄 Manual fix option:');
    console.log('1. Go to Firebase Console → Firestore');
    console.log('2. Find your account in the accounts collection');
    console.log('3. Update the user_id field to match your Firebase Auth UID');
  }
}

if (require.main === module) {
  quickUIDFix();
}

module.exports = quickUIDFix;