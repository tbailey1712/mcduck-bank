const admin = require("firebase-admin");

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

async function cleanupWrongAccounts() {
  const db = admin.firestore();
  
  // These are the wrong account documents that were created (using UIDs as doc IDs)
  const wrongAccountIds = [
    'PK5DaE2Cd2cE1KynZuSyawkRmZA3',
    'TJEZ0fCPMESFez0HNCl0dEu8UlA3', 
    'drgZjPBSvXRQTwOoitunqmzkg1n2'
  ];
  
  console.log('🗑️ Deleting incorrectly created account documents...');
  
  for (const wrongId of wrongAccountIds) {
    try {
      await db.collection('accounts').doc(wrongId).delete();
      console.log(`✅ Deleted wrong account document: ${wrongId}`);
    } catch (error) {
      console.error(`❌ Error deleting ${wrongId}:`, error);
    }
  }
  
  console.log('🧹 Cleanup completed');
}

cleanupWrongAccounts();