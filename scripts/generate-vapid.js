#!/usr/bin/env node

/**
 * Generate VAPID keys for Firebase Cloud Messaging
 * Run this script to generate the keys needed for push notifications
 */

const crypto = require('crypto');

function generateVAPIDKeys() {
  // Generate a key pair for VAPID
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'der'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der'
    }
  });

  // Convert to base64url format
  const publicKeyBase64 = publicKey.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const privateKeyBase64 = privateKey.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  console.log('🔐 VAPID Keys Generated:');
  console.log('');
  console.log('Public Key (use in client):');
  console.log(publicKeyBase64);
  console.log('');
  console.log('Private Key (use in server):');
  console.log(privateKeyBase64);
  console.log('');
  console.log('📝 Next steps:');
  console.log('1. Add the public key to your notificationService.js');
  console.log('2. Add the private key to your Firebase Functions environment');
  console.log('3. Configure FCM in Firebase Console');
}

// Alternative: Use Firebase CLI to generate VAPID keys
function showFirebaseCommand() {
  console.log('🔥 Alternatively, use Firebase CLI to generate VAPID keys:');
  console.log('');
  console.log('firebase projects:list');
  console.log('firebase use mcduck-bank-2025');
  console.log('firebase functions:config:set vapid.public_key="YOUR_PUBLIC_KEY" vapid.private_key="YOUR_PRIVATE_KEY"');
  console.log('');
  console.log('Or use Firebase Console:');
  console.log('1. Go to Project Settings > Cloud Messaging');
  console.log('2. Generate Web Push certificates');
  console.log('3. Copy the key pair');
}

console.log('🚀 McDuck Bank - VAPID Key Generator');
console.log('===================================');
console.log('');

// Check if we should use Firebase method
const useFirebase = process.argv.includes('--firebase');

if (useFirebase) {
  showFirebaseCommand();
} else {
  generateVAPIDKeys();
  console.log('');
  showFirebaseCommand();
}

console.log('');
console.log('⚠️  Important: Keep your private key secret and secure!');