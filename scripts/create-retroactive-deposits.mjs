// Import Firebase SDK instead of Admin SDK for client-side execution
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Firebase config - you'll need to replace these with your actual config values
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createRetroactiveDeposits() {
  console.log('🔄 Starting retroactive deposit creation for withdrawals...');
  
  try {
    // First, find all admin users
    const adminQuery = query(collection(db, 'accounts'), where('administrator', '==', true));
    const usersSnapshot = await getDocs(adminQuery);
    
    let primaryAdminId;
    
    if (usersSnapshot.empty) {
      console.error('❌ No admin accounts found. Creating default admin account...');
      // Create a default admin account for the house
      const adminAccount = {
        email: 'admin@mcduckbank.com',
        displayName: 'McDuck Bank - House Account',
        administrator: true,
        created_at: serverTimestamp(),
        balance: 0
      };
      
      const adminRef = await addDoc(collection(db, 'accounts'), adminAccount);
      console.log('✅ Created admin account:', adminRef.id);
      
      // Use this as our primary admin
      primaryAdminId = adminRef.id;
    } else {
      // Use the first admin found
      primaryAdminId = usersSnapshot.docs[0].id;
      console.log('📋 Using existing admin account:', primaryAdminId);
    }
    
    // Get all withdrawal transactions
    console.log('🔍 Finding all withdrawal transactions...');
    const withdrawalsQuery = query(collection(db, 'transactions'), where('transaction_type', '==', 'withdrawal'));
    const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
    
    console.log(`📊 Found ${withdrawalsSnapshot.size} withdrawal transactions`);
    
    let createdDeposits = 0;
    
    for (const withdrawalDoc of withdrawalsSnapshot.docs) {
      const withdrawal = withdrawalDoc.data();
      
      // Skip if this withdrawal already has a corresponding deposit
      const existingDepositQuery = query(
        collection(db, 'transactions'),
        where('linked_withdrawal_id', '==', withdrawalDoc.id),
        where('transaction_type', '==', 'deposit')
      );
      const existingDepositSnapshot = await getDocs(existingDepositQuery);
      
      if (!existingDepositSnapshot.empty) {
        console.log(`⏭️  Skipping withdrawal ${withdrawalDoc.id} - deposit already exists`);
        continue;
      }
      
      // Create corresponding deposit to admin account
      const depositData = {
        user_id: primaryAdminId,
        amount: withdrawal.amount,
        transaction_type: 'deposit',
        description: `House deposit from customer withdrawal (${withdrawal.user_id})`,
        comment: `Automatic house deposit for withdrawal: ${withdrawalDoc.id}`,
        timestamp: withdrawal.timestamp, // Use same timestamp as original withdrawal
        linked_withdrawal_id: withdrawalDoc.id, // Link back to original withdrawal
        created_by: 'retroactive_script',
        created_at: serverTimestamp()
      };
      
      await addDoc(collection(db, 'transactions'), depositData);
      createdDeposits++;
      
      console.log(`💰 Creating deposit for withdrawal ${withdrawalDoc.id}: $${withdrawal.amount}`);
    }
    
    if (createdDeposits > 0) {
      console.log(`✅ ${createdDeposits} retroactive deposits created successfully!`);
    } else {
      console.log('ℹ️  No new deposits needed - all withdrawals already have corresponding deposits');
    }
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`- Withdrawals found: ${withdrawalsSnapshot.size}`);
    console.log(`- New deposits created: ${createdDeposits}`);
    console.log(`- Primary admin account: ${primaryAdminId}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating retroactive deposits:', error);
    process.exit(1);
  }
}

createRetroactiveDeposits();