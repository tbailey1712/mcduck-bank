/**
 * McDuck Bank Data Migration Script
 * Migrates data from old Firebase project to new clean project
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  sourceProject: {
    // Replace with your old project service account key
    serviceAccountPath: './old-project-service-account.json',
    projectId: 'old-project-id' // Replace with old project ID
  },
  destProject: {
    // Replace with your new project service account key  
    serviceAccountPath: './new-project-service-account.json',
    projectId: 'new-project-id' // Replace with new project ID
  },
  collections: ['accounts', 'transactions', 'system', 'job_logs'],
  batchSize: 500 // Process in batches to avoid memory issues
};

// Initialize Firebase Admin for both projects
let sourceDb, destDb;

function initializeFirebase() {
  try {
    // Initialize source (old) project
    const sourceApp = admin.initializeApp({
      credential: admin.credential.cert(require(CONFIG.sourceProject.serviceAccountPath)),
      projectId: CONFIG.sourceProject.projectId
    }, 'source');
    sourceDb = admin.firestore(sourceApp);

    // Initialize destination (new) project
    const destApp = admin.initializeApp({
      credential: admin.credential.cert(require(CONFIG.destProject.serviceAccountPath)),
      projectId: CONFIG.destProject.projectId
    }, 'dest');
    destDb = admin.firestore(destApp);

    console.log('✅ Firebase Admin initialized for both projects');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    console.log('\n📋 Setup Instructions:');
    console.log('1. Download service account keys from Firebase Console');
    console.log('2. Place them in the migration/ directory');
    console.log('3. Update CONFIG object with correct paths and project IDs');
    process.exit(1);
  }
}

// Migrate a single collection
async function migrateCollection(collectionName) {
  console.log(`\n🔄 Migrating collection: ${collectionName}`);
  
  try {
    // Get all documents from source collection
    const sourceSnapshot = await sourceDb.collection(collectionName).get();
    
    if (sourceSnapshot.empty) {
      console.log(`⚠️  Collection ${collectionName} is empty, skipping...`);
      return { migrated: 0, errors: 0 };
    }

    console.log(`📊 Found ${sourceSnapshot.size} documents in ${collectionName}`);

    let migrated = 0;
    let errors = 0;
    let batch = destDb.batch();
    let batchCount = 0;

    // Process documents in batches
    for (const doc of sourceSnapshot.docs) {
      try {
        const data = doc.data();
        
        // Clean and validate data
        const cleanedData = cleanDocumentData(data, collectionName);
        
        const newDocRef = destDb.collection(collectionName).doc(doc.id);
        batch.set(newDocRef, cleanedData);
        batchCount++;

        // Commit batch when it reaches the limit
        if (batchCount >= CONFIG.batchSize) {
          await batch.commit();
          migrated += batchCount;
          console.log(`   ✅ Migrated ${migrated}/${sourceSnapshot.size} documents...`);
          
          // Start new batch
          batch = destDb.batch();
          batchCount = 0;
        }
      } catch (error) {
        console.error(`   ❌ Error migrating document ${doc.id}:`, error.message);
        errors++;
      }
    }

    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      migrated += batchCount;
    }

    console.log(`✅ Collection ${collectionName} migration completed:`);
    console.log(`   📈 Migrated: ${migrated} documents`);
    console.log(`   ❌ Errors: ${errors} documents`);

    return { migrated, errors };
  } catch (error) {
    console.error(`❌ Failed to migrate collection ${collectionName}:`, error.message);
    return { migrated: 0, errors: 1 };
  }
}

// Clean and validate document data
function cleanDocumentData(data, collectionName) {
  const cleaned = { ...data };

  // Convert any old timestamp formats to Firestore Timestamps
  Object.keys(cleaned).forEach(key => {
    const value = cleaned[key];
    
    // Handle timestamp fields
    if (key.includes('timestamp') || key.includes('date') || key === 'lastLogin') {
      if (value && typeof value === 'object' && value._seconds) {
        // Already a Firestore Timestamp
        cleaned[key] = admin.firestore.Timestamp.fromMillis(value._seconds * 1000 + (value._nanoseconds || 0) / 1000000);
      } else if (value && value.toDate) {
        // Firestore Timestamp object
        cleaned[key] = value;
      } else if (value && (typeof value === 'string' || typeof value === 'number')) {
        // String or number timestamp
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            cleaned[key] = admin.firestore.Timestamp.fromDate(date);
          }
        } catch (e) {
          console.warn(`   ⚠️  Could not convert timestamp field ${key}:`, value);
        }
      }
    }

    // Clean up any undefined or null values that might cause issues
    if (value === undefined) {
      delete cleaned[key];
    }
  });

  // Collection-specific cleaning
  switch (collectionName) {
    case 'accounts':
      // Ensure required fields for accounts
      if (!cleaned.user_id && !cleaned.uid) {
        cleaned.user_id = generateUserId();
      }
      // Normalize administrator field
      if (cleaned.administrator === undefined) {
        cleaned.administrator = false;
      }
      break;

    case 'transactions':
      // Ensure required fields for transactions
      if (!cleaned.user_id) {
        console.warn(`   ⚠️  Transaction missing user_id, may cause issues`);
      }
      if (!cleaned.transaction_type) {
        cleaned.transaction_type = 'unknown';
      }
      if (typeof cleaned.amount !== 'number') {
        cleaned.amount = parseFloat(cleaned.amount) || 0;
      }
      break;

    case 'system':
      // Ensure system config has required fields
      if (cleaned.interest_rate === undefined) {
        cleaned.interest_rate = 1.75; // Default interest rate
      }
      break;
  }

  return cleaned;
}

// Generate a unique user ID if missing
function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Verify migration by comparing document counts
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  const results = {};
  
  for (const collectionName of CONFIG.collections) {
    try {
      const sourceSnapshot = await sourceDb.collection(collectionName).get();
      const destSnapshot = await destDb.collection(collectionName).get();
      
      results[collectionName] = {
        source: sourceSnapshot.size,
        destination: destSnapshot.size,
        verified: sourceSnapshot.size === destSnapshot.size
      };
      
      const status = results[collectionName].verified ? '✅' : '❌';
      console.log(`${status} ${collectionName}: ${results[collectionName].source} → ${results[collectionName].destination}`);
    } catch (error) {
      console.error(`❌ Error verifying ${collectionName}:`, error.message);
      results[collectionName] = { verified: false, error: error.message };
    }
  }
  
  return results;
}

// Create initial system configuration if it doesn't exist
async function createSystemConfig() {
  console.log('\n⚙️  Creating system configuration...');
  
  try {
    const systemConfigRef = destDb.collection('system').doc('config');
    const systemConfigSnap = await systemConfigRef.get();
    
    if (!systemConfigSnap.exists) {
      await systemConfigRef.set({
        interest_rate: 1.75,
        created_at: admin.firestore.Timestamp.now(),
        version: '2.0'
      });
      console.log('✅ System config created with default values');
    } else {
      console.log('✅ System config already exists');
    }
  } catch (error) {
    console.error('❌ Failed to create system config:', error.message);
  }
}

// Main migration function
async function migrate() {
  console.log('🚀 Starting McDuck Bank Data Migration\n');
  console.log(`📤 Source: ${CONFIG.sourceProject.projectId}`);
  console.log(`📥 Destination: ${CONFIG.destProject.projectId}`);
  console.log(`📋 Collections: ${CONFIG.collections.join(', ')}\n`);

  const startTime = Date.now();
  const results = {
    collections: {},
    totalMigrated: 0,
    totalErrors: 0
  };

  // Initialize Firebase
  initializeFirebase();

  // Migrate each collection
  for (const collectionName of CONFIG.collections) {
    const result = await migrateCollection(collectionName);
    results.collections[collectionName] = result;
    results.totalMigrated += result.migrated;
    results.totalErrors += result.errors;
  }

  // Create system config if needed
  await createSystemConfig();

  // Verify migration
  const verification = await verifyMigration();

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n🎉 Migration Summary:');
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📈 Total migrated: ${results.totalMigrated} documents`);
  console.log(`❌ Total errors: ${results.totalErrors} documents`);
  
  const allVerified = Object.values(verification).every(v => v.verified);
  console.log(`✅ Verification: ${allVerified ? 'PASSED' : 'FAILED'}`);

  if (!allVerified) {
    console.log('\n⚠️  Some collections may need manual review');
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Update your app\'s Firebase config');
  console.log('2. Deploy cloud functions');
  console.log('3. Test the application thoroughly');
  console.log('4. Set up Cloud Scheduler cron jobs');
  
  process.exit(allVerified ? 0 : 1);
}

// Run migration
if (require.main === module) {
  migrate().catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { migrate, migrateCollection, verifyMigration };