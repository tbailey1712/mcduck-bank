const admin = require("firebase-admin");

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

async function setAdminClaim() {
  const userEmail = 'tony.bailey@gmail.com';
  
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    console.log('Found user:', userRecord.uid, userRecord.email);
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      administrator: true
    });
    
    console.log(`✅ Successfully set administrator claim for ${userEmail}`);
    console.log('The user will need to refresh their token (log out and back in) for changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error setting admin claim:', error);
  }
}

setAdminClaim();