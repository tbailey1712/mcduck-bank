#!/usr/bin/env node

/**
 * Get Firebase VAPID key from Firebase Console
 * This script guides you through getting the correct VAPID key
 */

console.log('🔥 Firebase VAPID Key Setup Guide');
console.log('====================================');
console.log('');
console.log('To get your VAPID key for push notifications:');
console.log('');
console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
console.log('2. Select your project: mcduck-bank-2025');
console.log('3. Go to Project Settings (gear icon)');
console.log('4. Click on "Cloud Messaging" tab');
console.log('5. Scroll down to "Web configuration"');
console.log('6. Look for "Web Push certificates"');
console.log('7. If no certificate exists, click "Generate key pair"');
console.log('8. Copy the "Key pair" value (starts with "B...")');
console.log('');
console.log('Alternative method using Firebase CLI:');
console.log('');
console.log('1. Run: firebase messaging:webpush:get');
console.log('');
console.log('📝 Once you have the key:');
console.log('1. Update src/services/notificationService.js');
console.log('2. Replace the vapidKey value');
console.log('3. Rebuild and redeploy');
console.log('');
console.log('⚠️  The key should look like:');
console.log('   B_a_long_string_of_characters_ending_with_letters');
console.log('');

// Try to get it via Firebase CLI
const { exec } = require('child_process');

console.log('🔄 Attempting to get VAPID key via Firebase CLI...');
console.log('');

exec('firebase messaging:webpush:get', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ Could not get VAPID key via CLI. Please use the manual method above.');
    console.log('Error:', error.message);
    return;
  }
  
  if (stderr) {
    console.log('⚠️  Warning:', stderr);
  }
  
  if (stdout) {
    console.log('✅ VAPID Key from Firebase CLI:');
    console.log(stdout);
    console.log('');
    console.log('📋 Copy this key and update notificationService.js');
  }
});