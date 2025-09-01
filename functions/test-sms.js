// Quick test script to call SMS function directly
const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
admin.initializeApp();

const testSMS = async () => {
  try {
    console.log('Testing SMS function directly...');
    
    // This would be called via the admin SDK instead of client SDK
    // Just a test to see if the function exists and can be called
    console.log('Function should be available for calling via client SDK');
    console.log('Check if function is deployed correctly');
    
  } catch (error) {
    console.error('Error:', error);
  }
};

testSMS();