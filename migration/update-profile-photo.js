#!/usr/bin/env node

/**
 * Update Profile Photo Script
 * 
 * This script updates your account record with the current Google profile photo URL
 */

const admin = require('firebase-admin');

const YOUR_EMAIL = 'tony.bailey@gmail.com';

async function updateProfilePhoto() {
  try {
    // Initialize Firebase Admin
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    const db = admin.firestore();
    const auth = admin.auth();

    console.log('🔍 Fetching current Google profile data...');

    // Get current Firebase Auth user
    const firebaseUser = await auth.getUserByEmail(YOUR_EMAIL);
    console.log('✅ Firebase user data:');
    console.log('   UID:', firebaseUser.uid);
    console.log('   Display Name:', firebaseUser.displayName);
    console.log('   Photo URL:', firebaseUser.photoURL);

    if (!firebaseUser.photoURL) {
      console.log('❌ No photo URL found in Firebase Auth');
      console.log('   Make sure you have a profile picture set in your Google account');
      return;
    }

    // Find account in Firestore
    console.log('\n🔍 Finding account in Firestore...');
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
    console.log('   Current photoURL:', accountData.photoURL || 'none');
    console.log('   Current displayName:', accountData.displayName || 'none');

    // Update with current Firebase data
    const updateData = {};
    
    if (firebaseUser.photoURL) {
      updateData.photoURL = firebaseUser.photoURL;
    }
    
    if (firebaseUser.displayName && !accountData.displayName) {
      updateData.displayName = firebaseUser.displayName;
    }

    if (Object.keys(updateData).length === 0) {
      console.log('✅ Account already up to date');
      return;
    }

    console.log('\n🔧 Updating account with:', updateData);
    await accountDoc.ref.update(updateData);

    console.log('✅ Account updated successfully!');
    console.log('   Your profile photo should now appear in the app');

  } catch (error) {
    console.error('❌ Update failed:', error.message);
  }
}

if (require.main === module) {
  updateProfilePhoto();
}

module.exports = updateProfilePhoto;