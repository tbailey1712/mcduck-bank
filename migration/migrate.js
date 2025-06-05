const admin = require('firebase-admin');

// Initialize source (old) project
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(require('./old-project-key.json'))
}, 'source');
const sourceDb = admin.firestore(sourceApp);

// Initialize destination (new) project  
const destApp = admin.initializeApp({
  credential: admin.credential.cert(require('./new-project-key.json'))
}, 'dest');
const destDb = admin.firestore(destApp);

async function migrateCollection(collectionName) {
  console.log(`Migrating ${collectionName}...`);
  
  const sourceCollection = await sourceDb.collection(collectionName).get();
  const batch = destDb.batch();
  
  sourceCollection.forEach(doc => {
    const newDocRef = destDb.collection(collectionName).doc(doc.id);
    batch.set(newDocRef, doc.data());
  });
  
  await batch.commit();
  console.log(`✅ ${collectionName}: ${sourceCollection.size} documents migrated`);
}

async function migrate() {
  try {
    // Migrate all collections
    await migrateCollection('accounts');
    await migrateCollection('transactions');
    await migrateCollection('system');
    await migrateCollection('job_logs'); // if exists
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrate();

