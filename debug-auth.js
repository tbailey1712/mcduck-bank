#!/usr/bin/env node

/**
 * Debug Authentication Issue
 * 
 * This script helps debug why a user can't log in after migration.
 * It compares Firebase Auth UIDs with database user_id values.
 */

const admin = require('firebase-admin');
const fs = require('fs');

// You'll need to provide your email here
const YOUR_EMAIL = process.argv[2] || 'your-email@example.com';

async function debugAuth() {
  try {
    // Initialize Firebase Admin (you'll need serviceAccountKey.json)
    if (!fs.existsSync('./serviceAccountKey.json')) {
      console.log('❌ Please download serviceAccountKey.json from Firebase Console');
      console.log('   Project Settings → Service Accounts → Generate new private key');
      return;
    }

    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const db = admin.firestore();
    const auth = admin.auth();

    console.log('🔍 Debugging authentication for:', YOUR_EMAIL);
    console.log('=====================================');

    // 1. Check Firebase Auth
    console.log('\n1️⃣ Checking Firebase Auth...');
    try {
      const userRecord = await auth.getUserByEmail(YOUR_EMAIL);
      console.log(`✅ Found in Firebase Auth:`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Created: ${new Date(userRecord.metadata.creationTime)}`);
    } catch (error) {
      console.log(`❌ NOT found in Firebase Auth: ${error.message}`);
      console.log(`   Have you logged into the new project yet?`);
      return;
    }

    // 2. Check Firestore Accounts by email
    console.log('\n2️⃣ Checking Firestore accounts by email...');
    const emailQuery = await db.collection('accounts')
      .where('email', '==', YOUR_EMAIL)
      .get();

    if (emailQuery.empty) {
      console.log(`❌ NOT found in accounts collection by email`);
    } else {
      emailQuery.forEach(doc => {
        const data = doc.data();
        console.log(`✅ Found in accounts collection:`);
        console.log(`   Document ID: ${doc.id}`);
        console.log(`   user_id: ${data.user_id}`);
        console.log(`   email: ${data.email}`);
        console.log(`   administrator: ${data.administrator}`);
      });
    }

    // 3. Check if there's a mismatch
    console.log('\n3️⃣ Checking for UID mismatch...');
    const authUser = await auth.getUserByEmail(YOUR_EMAIL);
    const authUID = authUser.uid;

    const accountDoc = emailQuery.docs[0];
    if (accountDoc) {
      const accountData = accountDoc.data();
      const dbUserID = accountData.user_id;

      if (authUID === dbUserID) {
        console.log(`✅ UIDs match! This should work.`);
        console.log(`   Firebase Auth UID: ${authUID}`);
        console.log(`   Database user_id:  ${dbUserID}`);
        console.log(`\n🤔 The issue might be elsewhere. Check browser console for errors.`);
      } else {
        console.log(`❌ UID MISMATCH! This is the problem.`);
        console.log(`   Firebase Auth UID: ${authUID}`);
        console.log(`   Database user_id:  ${dbUserID}`);
        console.log(`\n🔧 Solution: Run the UID mapping fix script.`);
      }
    }

    // 4. Check transactions
    console.log('\n4️⃣ Checking transactions...');
    if (accountDoc) {
      const accountData = accountDoc.data();
      const transQuery = await db.collection('transactions')
        .where('user_id', '==', accountData.user_id)
        .limit(3)
        .get();

      console.log(`   Found ${transQuery.size} transactions with user_id: ${accountData.user_id}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

if (require.main === module) {
  if (process.argv.length < 3) {
    console.log('Usage: node debug-auth.js your-email@example.com');
    process.exit(1);
  }
  debugAuth();
}